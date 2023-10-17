import { type SignedState } from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";

export enum MessageType {
  RequestInvoice = "requestInvoice",
  Invoice = "invoice",
  ForwardPayment = "forwardPayment",
  UnlockHTLC = "unlockHTLC",
  UserOperation = "userOperation",
}

export type Message =
  | Invoice
  | RequestInvoice
  | ForwardPaymentRequest
  | UnlockHTLCRequest
  | UserOperation;
export interface Invoice {
  type: MessageType.Invoice;
  amount: number;
  hashLock: string;
}
interface RequestInvoice {
  type: MessageType.RequestInvoice;
  amount: number;
  from: string; // where to send the invoice
}
export interface ForwardPaymentRequest {
  type: MessageType.ForwardPayment;
  /**
   * the scw address whose owner is the payee
   */
  target: string;
  amount: number;
  hashLock: string;
  timelock: number;
  updatedState: SignedState; // includes the "source" HTLC which makes the payment safe for the intermediary
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
