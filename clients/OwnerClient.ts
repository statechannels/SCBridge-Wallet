import {
  type Invoice,
  type scwMessageEvent,
  MessageType,
  type ForwardPaymentRequest,
  type UnlockHTLCRequest,
} from "./Messages";
import { ethers, getBytes } from "ethers";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/SCBridgeWallet";
import { fillUserOpDefaults } from "./UserOp";
import { IAccount } from "./utils";
import { hashState } from "./State";

export class OwnerClient extends StateChannelWallet {
  private nonce = 0;
  constructor(params: StateChannelWalletParams) {
    super(params);
    if (this.myRole() !== Participant.Owner) {
      throw new Error("Signer is not owner");
    }
    this.attachMessageHandlers();
    console.log("listening on " + this.globalBroadcastChannel.name);
  }

  private log(s: string): void {
    console.log(`[OwnerClient] ${s}`);
  }

  private attachMessageHandlers(): void {
    // These handlers are for messages from parties outside of our wallet / channel.
    this.globalBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;
      console.log("received message: ", req);

      if (req.type === MessageType.RequestInvoice) {
        const hash = await this.createNewHash();
        const invoice: Invoice = {
          type: MessageType.Invoice,
          hashLock: hash,
          amount: req.amount,
          chain: req.chain,
        };

        // return the invoice to the payer on the same channel we received the request
        this.globalBroadcastChannel.postMessage(invoice);
      }
    };

    // These handlers are for messages from the channel/wallet peer (our intermediary).
    this.peerBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;
      switch (req.type) {
        case MessageType.ForwardPayment:
          await this.handleIncomingHTLC(req);
          break;
        case MessageType.UnlockHTLC:
          await this.handleUnlockHTLCRequest(req);
          break;
        default:
          throw new Error(`Message type ${req.type} not yet handled`);
      }
    };
  }

  private async handleUnlockHTLCRequest(req: UnlockHTLCRequest): Promise<void> {
    this.log("received unlock HTLC request");
    // run the preimage through the state update function
    const updated = await this.unlockHTLC(req.preimage);
    const updatedHash = hashState(updated.state);

    // check that the proposed update is correct
    if (updatedHash !== hashState(req.updatedState.state)) {
      throw new Error("Invalid state update");
      // todo: peerMessage to sender with failure
    }
    const signer = ethers.recoverAddress(
      ethers.hashMessage(getBytes(updatedHash)),
      req.updatedState.intermediarySignature,
    );
    if (signer !== this.intermediaryAddress) {
      throw new Error("Invalid signature");
      // todo: peerMessage to sender with failure
    }
    this.ack(updated.ownerSignature);
    this.addSignedState({
      state: req.updatedState.state,
      ownerSignature: updated.ownerSignature,
      intermediarySignature: req.updatedState.intermediarySignature,
    });
  }

  private async handleIncomingHTLC(req: ForwardPaymentRequest): Promise<void> {
    this.log("received forward payment request");
    // todo: validate that the proposed state update is "good"
    // add the HTLC to our state
    const mySig = this.signState(req.updatedState.state);
    this.addSignedState({
      ...req.updatedState,
      ownerSignature: mySig.ownerSignature,
      intermediarySignature: req.updatedState.intermediarySignature,
    });
    this.ack(mySig.ownerSignature);

    // claim the payment if it is for us
    const preimage = this.hashStore.get(req.invoice.hashLock);

    if (preimage === undefined) {
      throw new Error("Hashlock not found");
      // todo: or forward the payment if it is multihop (not in scope for now)
    }

    // we are the end claimant, so we should:
    //  - unlock the payment
    //  - send the updated state to the intermediary
    //  - store the updated state with both signatures
    this.log("attempting unlock w/ Irene");
    const updatedAfterUnlock = await this.unlockHTLC(preimage);
    const intermediaryAck = await this.sendPeerMessage({
      type: MessageType.UnlockHTLC,
      preimage,
      updatedState: updatedAfterUnlock,
    });
    this.log("unlocked w/ Irene:" + intermediaryAck.signature);
    this.addSignedState({
      state: updatedAfterUnlock.state,
      ownerSignature: updatedAfterUnlock.ownerSignature,
      intermediarySignature: intermediaryAck.signature,
    });
  }

  /**
   * Coordinates with the payee to transfer funds to them. Payee is first
   * asked for a hashlock, then the lock is used to forward payment via
   * the intermediary.
   *
   * @param payee the SCBridgeWallet address we want to pay to
   * @param amount the amount we want to pay
   */
  async pay(payee: string, amount: bigint): Promise<void> {
    // contact `payee` and request an invoice
    const invoice = await this.sendGlobalMessage(payee, {
      type: MessageType.RequestInvoice,
      chain: await this.getHostNetwork(),
      amount,
    });

    if (invoice.type !== MessageType.Invoice) {
      throw new Error("Unexpected response");
    }
    console.log("received invoice: ", invoice);

    // create a state update with the hashlock
    const signedUpdate = this.addHTLC(amount, invoice.hashLock);

    // send the state update to the intermediary
    const intermediaryAck = await this.sendPeerMessage({
      type: MessageType.ForwardPayment,
      target: payee,
      invoice,
      timelock: BigInt(0), // todo
      updatedState: signedUpdate,
    });

    // and store co-signed state locally
    this.addSignedState({
      state: signedUpdate.state,
      ownerSignature: signedUpdate.ownerSignature,
      intermediarySignature: intermediaryAck.signature,
    });
  }

  // Create L1 payment UserOperation and forward to intermediary
  async payL1(payee: string, amount: bigint): Promise<string> {
    // Only need to encode 'to' and 'amount' fields (i.e. no 'data') for basic eth transfer
    const callData = IAccount.encodeFunctionData("execute", [
      payee,
      amount,
      "0x", // specifying no data makes sure the call is interpreted as a basic eth transfer
    ]);
    const partialUserOp: Partial<UserOperationStruct> = {
      sender: this.scBridgeWalletAddress,
      callData,
      nonce: this.nonce,
      // TODO: Clean up these defaults
      callGasLimit: 40_000,
      verificationGasLimit: 150000,
      preVerificationGas: 21000,
      maxFeePerGas: 40_000,
      maxPriorityFeePerGas: 40_000,
    };
    const userOp = fillUserOpDefaults(partialUserOp);
    const { signature, hash } = await this.signUserOperation(userOp);
    const signedUserOp: UserOperationStruct = {
      ...userOp,
      signature,
    };

    void this.sendPeerMessage({
      type: MessageType.UserOperation,
      ...signedUserOp,
    });

    console.log(
      `Initiated transfer of ${ethers.formatEther(
        amount,
      )} ETH to ${payee} (userOpHash: ${hash})`,
    );

    // Increment nonce for next transfer
    this.nonce++;

    return hash;
  }
}
