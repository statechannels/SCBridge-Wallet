import { ethers, getBytes } from "ethers";
import {
  type scwMessageEvent,
  MessageType,
  type ForwardPaymentRequest,
  type UnlockHTLCRequest,
} from "./Messages";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/SCBridgeWallet";
import { IAccount } from "./utils";
import { hashState } from "./State";
import { convertInvoice } from "./Accounting";
import { chains } from "../src/chains";

/**
 * The IntermediaryCoordinator orchestrates an intermediary's participation in the network. It contains
 * a collection of IntermediaryClients, each of which is the intermediary's view into a single channelWallet.
 */
export class IntermediaryCoordinator {
  /**
   * The collection of channel clients that this coordinator is responsible for.
   *
   * EG, for Irene, these clients  would be [Alice, Bob]
   */
  private readonly channelClients: IntermediaryClient[] = [];

  public registerChannel(channelClient: IntermediaryClient): void {
    channelClient.registerCoordinator(this);
    this.channelClients.push(channelClient);
  }

  constructor(channelClients: IntermediaryClient[]) {
    channelClients.forEach((c) => {
      this.registerChannel(c);
    });
  }

  log(s: string): void {
    console.log(`[Coordinator] ${s}`);
  }

  public uiLog(s: string): void {
    this.logs.push(s);
  }

  private readonly logs: string[] = [];

  public getLogsTail(): string[] {
    return this.logs.slice(-10);
  }

  /**
   * forwardHTLC moves a payment across the network. It is called by a channelWallet who has
   * verified that the payment is safe to forward.
   *
   * @param htlc the HTLC to forward
   */
  async forwardHTLC(htlc: ForwardPaymentRequest): Promise<void> {
    // Locate the target client
    const targetClient = this.channelClients.find(
      (c) => c.getAddress() === htlc.target || c.ownerAddress === htlc.target,
    );

    if (targetClient === undefined) {
      throw new Error("Target not found");
      // todo: return a failure message to the sender?
    }

    const targetNetwork = await targetClient.getHostNetwork();

    if (targetNetwork !== htlc.invoice.chain) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const sourceChain = chains.find((c) => c.chainID === htlc.invoice.chain)!;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const targetChain = chains.find((c) => c.chainID === targetNetwork)!;

      const sourceAmount = htlc.invoice.amount;

      htlc.invoice = convertInvoice(htlc.invoice, targetNetwork);
      const targetAmount = htlc.invoice.amount;

      this.uiLog(
        `currency conversion from ${sourceAmount} ${sourceChain.symbol} to ${targetAmount} ${targetChain.symbol}`,
      );
      this.uiLog(
        `  at [${sourceChain.exchangeRate} / ${targetChain.exchangeRate}] exchange rate`,
      );
    }

    const fee = 0; // for example

    const updatedState = await targetClient.addHTLC(
      htlc.invoice.amount - BigInt(fee),
      htlc.invoice.hashLock,
    );

    // this.log("adding HTLC to Irene-Bob");
    const ownerAck = await targetClient.sendPeerMessage({
      type: MessageType.ForwardPayment,
      target: htlc.target,
      invoice: htlc.invoice,
      timelock: BigInt(0), // todo
      updatedState,
    });
    // this.log("added HTLC to Irene-Bob: " + ownerAck.signature);

    targetClient.addSignedState({
      ...updatedState,
      intermediarySignature: updatedState.intermediarySignature,
      ownerSignature: ownerAck.signature,
    });
    this.uiLog("Forwarded HTLC to " + targetClient.getAddress());
  }

  async unlockHTLC(req: UnlockHTLCRequest): Promise<void> {
    // find the channel client that has the HTLC
    const targetClient = this.channelClients.find((c) =>
      c.hasHTLC(req.preimage),
    );

    if (targetClient === undefined) {
      throw new Error("Target not found");
    }

    // this.log("removing HTLC from Alice-Irene:" + targetClient.getAddress());
    // claim the payment and coordinate with the channel owner to update
    // the shared state
    const updated = await targetClient.unlockHTLC(req.preimage);

    // the intermediary asks the channel owner to update the state
    const ownerAck = await targetClient.sendPeerMessage({
      type: MessageType.UnlockHTLC,
      preimage: req.preimage,
      updatedState: updated,
    });
    // this.log("removed HTLC from Alice-Irene:" + ownerAck.signature);

    targetClient.addSignedState({
      state: updated.state,
      intermediarySignature: updated.intermediarySignature,
      ownerSignature: ownerAck.signature,
    });
    this.uiLog("Unlocked HTLC from " + targetClient.getAddress());
  }
}

export class IntermediaryClient extends StateChannelWallet {
  private coordinator: IntermediaryCoordinator = new IntermediaryCoordinator(
    [],
  );

  private log(s: string): void {
    console.log(
      `[IntermediaryClient-${this.ownerAddress.substring(0, 5)}] ${s}`,
    );
  }

  constructor(params: StateChannelWalletParams) {
    super(params);
    if (this.myRole() !== Participant.Intermediary) {
      throw new Error("Signer is not intermediary");
    }
    this.attachMessageHandlers();
  }

  public registerCoordinator(coordinator: IntermediaryCoordinator): void {
    this.coordinator = coordinator;
  }

  private attachMessageHandlers(): void {
    // peer channel
    this.peerBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;
      this.log(`received message of type ${req.type}`);

      switch (req.type) {
        case MessageType.ForwardPayment:
          await this.handleForwardPaymentRequest(req);
          break;
        case MessageType.UserOperation:
          void this.handleUserOp(req);
          break;
        case MessageType.UnlockHTLC:
          void this.handleUnlockHTLC(req);
          break;
        default:
          throw new Error(`Message type ${req.type} not yet handled`);
      }
    };
  }

  private async handleForwardPaymentRequest(
    req: ForwardPaymentRequest,
  ): Promise<void> {
    // todo: more robust checks. EG: signature of counterparty
    if (req.invoice.amount > (await this.getOwnerBalance())) {
      throw new Error("Insufficient balance");
    }
    const mySig = this.signState(req.updatedState.state);
    this.addSignedState({
      state: req.updatedState.state,
      ownerSignature: req.updatedState.ownerSignature,
      intermediarySignature: mySig.intermediarySignature,
    });
    this.ack(mySig.intermediarySignature);
    this.coordinator.uiLog("received HTLC in " + this.scBridgeWalletAddress);
    await this.coordinator.forwardHTLC(req);
  }

  private async handleUnlockHTLC(req: UnlockHTLCRequest): Promise<void> {
    console.log("received unlock HTLC request");
    // run the preimage through the state update function
    const locallyUpdated = await this.unlockHTLC(req.preimage);
    const updatedHash = hashState(locallyUpdated.state);

    // check that the proposed update is correct
    if (updatedHash !== hashState(req.updatedState.state)) {
      throw new Error("Invalid state update");
      // todo: peerMessage to sender with failure
    }

    const signer = ethers.recoverAddress(
      ethers.hashMessage(getBytes(updatedHash)),
      req.updatedState.ownerSignature,
    );
    if (signer !== this.ownerAddress) {
      throw new Error(
        `Invalid signature: recovered ${signer}, wanted ${this.ownerAddress}`,
      );
      // todo: peerMessage to sender with failure
    }

    // update our state
    this.addSignedState({
      state: req.updatedState.state,
      ownerSignature: req.updatedState.ownerSignature,
      intermediarySignature: locallyUpdated.intermediarySignature,
    });
    // return our signature to the owner so that they can update the state
    this.ack(locallyUpdated.intermediarySignature);

    // Bob has claimed is payment, so we now claim our linked payment from Alice
    // via the channel coordinator
    void this.coordinator.unlockHTLC(req);
  }

  /**
   * hasHTLC returns true if the channel has an HTLC matching the given preimage
   */
  public hasHTLC(preimage: Uint8Array): boolean {
    const evmHashLock = ethers.keccak256(preimage);
    const lnHashLock = ethers.sha256(preimage);

    return this.currentState().htlcs.some(
      (h) => h.hashLock === evmHashLock || h.hashLock === lnHashLock,
    );
  }

  private async handleUserOp(userOp: UserOperationStruct): Promise<void> {
    this.coordinator.uiLog(`received user op in ` + this.scBridgeWalletAddress);
    // Only sign if the amount transferred is under owner's balance
    const decodedData = IAccount.decodeFunctionData("execute", userOp.callData);
    const value = decodedData[1] as bigint;
    const balanceETH = await this.getOwnerBalance();
    const balanceWEI = ethers.parseEther(balanceETH.toString());

    if (value > balanceWEI) {
      // todo: account for expected gas consumption? ( out of scope for hackathon )
      this.coordinator.uiLog("insufficient balance to execute user op");
      this.ack("insufficient balance to execute user op");
      throw new Error("Transfer amount exceeds owner balance");
    }
    const ownerSig = userOp.signature;
    const { signature: intermediarySig, hash } =
      await this.signUserOperation(userOp);
    userOp.signature = ethers.concat([ownerSig, intermediarySig]);

    // TODO: We expect this validate call to pass or revert
    // However it fails with a Result decoding error
    const validateResult = await this.scwContract
      .getFunction("validateUserOp")
      .staticCall(userOp, hash, 0);
    if (validateResult !== BigInt(0)) {
      throw new Error("Userop failed validation");
    }

    const result = await this.entrypointContract.handleOps(
      [userOp],
      this.signer.address,
    );
    // Waiting for the transaction to be mined let's us catch the error
    const tx = await result.wait();
    if (tx !== null) {
      this.coordinator.uiLog("user op mined: " + tx.hash);
      this.ack(tx.hash);
    } else {
      this.ack("something terrible has happened");
    }
  }
}
