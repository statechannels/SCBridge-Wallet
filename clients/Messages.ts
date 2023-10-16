import { type SignedState } from './StateChannelWallet'

export enum MessageType {
  RequestInvoice = 'requestInvoice',
  Invoice = 'invoice',
  ForwardPayment = 'forwardPayment'
}

export type Message = Invoice | RequestInvoice | ForwardPaymentRequest
export interface Invoice {
  type: MessageType.Invoice
  amount: number
  hashLock: string
}
interface RequestInvoice {
  type: MessageType.RequestInvoice
  amount: number
}
interface ForwardPaymentRequest {
  type: MessageType.ForwardPayment
  target: string // scw address whose owner is the payee
  amount: number
  hashLock: string
  timelock: number
  updatedState: SignedState // includes the "source" HTLC which makes the payment safe for the intermediary
}

/**
 * A shim type on top of BroadcastChannel's MessageEvent, which passes
 * message payload through the `data` property.
 */
export type scwMessageEvent = MessageEvent & { data: Message }
