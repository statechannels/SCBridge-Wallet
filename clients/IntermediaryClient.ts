import { ethers } from "ethers";
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

    const fee = 0; // for example
    const updatedState = targetClient.addHTLC(htlc.amount - fee, htlc.hashLock);

    // this.log("adding HTLC to Irene-Bob");
    const ownerAck = await targetClient.sendPeerMessage({
      type: MessageType.ForwardPayment,
      target: htlc.target,
      amount: htlc.amount,
      hashLock: htlc.hashLock,
      timelock: 0, // todo
      updatedState,
    });
    // this.log("added HTLC to Irene-Bob: " + ownerAck.signature);

    targetClient.addSignedState({
      ...updatedState,
      intermediarySignature: updatedState.intermediarySignature,
      ownerSignature: ownerAck.signature,
    });
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
  }
}

export class IntermediaryClient extends StateChannelWallet {
  private coordinator: IntermediaryCoordinator = new IntermediaryCoordinator(
    [],
  );

  constructor(params: StateChannelWalletParams) {
    super(params);
    this.attachMessageHandlers();
  }

  public registerCoordinator(coordinator: IntermediaryCoordinator): void {
    this.coordinator = coordinator;
  }

  private attachMessageHandlers(): void {
    // peer channel
    this.peerBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;

      switch (req.type) {
        case MessageType.ForwardPayment:
          // todo: more robust checks. EG: signature of counterparty
          if (req.amount > (await this.getOwnerBalance())) {
            throw new Error("Insufficient balance");
          }
          this.coordinator.forwardHTLC(req);
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
      updatedHash,
      req.updatedState.ownerSignature,
    );
    if (signer !== this.ownerAddress) {
      // todo: fix signature recovery
      //
      // throw new Error(
      //   `Invalid signature: recovered ${signer}, wanted ${this.ownerAddress}`,
      // );
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
    // Only sign if the amount transferred is under owner's balance
    const decodedData = IAccount.decodeFunctionData("execute", userOp.callData);
    const value = decodedData[1] as bigint;
    const balanceETH = await this.getOwnerBalance();
    const balanceWEI = ethers.parseEther(balanceETH.toString());

    if (value > balanceWEI) {
      // todo: account for expected gas consumption? ( out of scope for hackathon )
      throw new Error("Transfer amount exceeds owner balance");
    }

    const ownerSig = userOp.signature.slice(0, 65);
    const intermediarySig = await this.signUserOperation(userOp);
    userOp.signature = ethers.concat([ownerSig, intermediarySig]);

    await this.entrypointContract.handleOps([userOp], this.getAddress());
  }

  static async create(
    params: StateChannelWalletParams,
  ): Promise<IntermediaryClient> {
    const instance = new IntermediaryClient(params);

    if (instance.myRole() !== Participant.Intermediary) {
      throw new Error("Signer is not owner");
    }

    await IntermediaryClient.hydrateWithChainData(instance);
    return instance;
  }
}
