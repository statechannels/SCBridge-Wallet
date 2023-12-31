import { type SignedState } from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/SCBridgeWallet";
import { type ChainID } from "../src/chains";

export enum MessageType {
  RequestInvoice = "requestInvoice",
  Invoice = "invoice",
  ForwardPayment = "forwardPayment",
  UnlockHTLC = "unlockHTLC",
  UserOperation = "userOperation",
  Signature = "signature",
}

export type Message =
  | Invoice
  | RequestInvoice
  | ForwardPaymentRequest
  | UnlockHTLCRequest
  | UserOperation
  | SignatureMessage;
export interface Invoice {
  type: MessageType.Invoice;
  amount: bigint;
  chain: ChainID;
  hashLock: string;
}
interface RequestInvoice {
  type: MessageType.RequestInvoice;
  chain: ChainID;
  amount: bigint;
}
export interface ForwardPaymentRequest {
  type: MessageType.ForwardPayment;
  /**
   * the scw address whose owner is the payee
   */
  target: string;
  invoice: Invoice;
  timelock: bigint;
  updatedState: SignedState; // includes the "source" HTLC which makes the payment safe for the intermediary
}

export interface SignatureMessage {
  type: MessageType.Signature;
  signature: string;
}

export interface UnlockHTLCRequest {
  type: MessageType.UnlockHTLC;
  /**
   * the preimage that unlocks the HTLC. This is the evidence that our peer
   * needs to recognize the legitimacy of the proposed state update.
   */
  preimage: Uint8Array;
  /**
   * the updated state after the HTLC is unlocked. This is the state that
   * we are seeking agreement on.
   */
  updatedState: SignedState;
}

interface UserOperation extends UserOperationStruct {
  type: MessageType.UserOperation;
}

/**
 * A shim type on top of BroadcastChannel's MessageEvent, which passes
 * message payload through the `data` property.
 */
export interface scwMessageEvent {
  data: Message;
}
