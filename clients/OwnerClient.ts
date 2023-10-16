import { type Invoice, type scwMessageEvent, MessageType } from "./Messages";
import { ethers } from "ethers";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";
import { fillUserOpDefaults } from "./UserOp";

const accountABI = ["function execute(address to, uint256 value, bytes data)"];
const account = new ethers.Interface(accountABI);

export class OwnerClient extends StateChannelWallet {
  constructor(params: StateChannelWalletParams) {
    super(params);

    this.attachMessageHandlers();
    console.log("listening on " + this.globalBroadcastChannel.name);
  }

  private attachMessageHandlers(): void {
    // These handlers are for messages from parties outside of our wallet / channel.
    this.globalBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;
      console.log("received message: " + JSON.stringify(req));

      if (req.type === MessageType.RequestInvoice) {
        const hash = await this.createNewHash();
        const invoice: Invoice = {
          type: MessageType.Invoice,
          hashLock: hash,
          amount: req.amount,
        };

        // return the invoice to the payer
        this.sendGlobalMessage(req.from, invoice);
      }
    };
  }

  static async create(params: StateChannelWalletParams): Promise<OwnerClient> {
    const instance = new OwnerClient(params);

    if (instance.myRole() !== Participant.Owner) {
      throw new Error("Signer is not owner");
    }

    await OwnerClient.hydrateWithChainData(instance);
    return instance;
  }

  /**
   * Coordinates with the payee to transfer funds to them. Payee is first
   * asked for a hashlock, then the lock is used to forward payment via
   * the intermediary.
   *
   * @param payee the SCBridgeWallet address we want to pay to
   * @param amount the amount we want to pay
   */
  async pay(payee: string, amount: number): Promise<void> {
    // contact `payee` and request a hashlock
    const requestChannel = this.sendGlobalMessage(payee, {
      type: MessageType.RequestInvoice,
      amount,
    });

    const invoice: Invoice = await new Promise((resolve, reject) => {
      // todo: resolve failure on a timeout
      requestChannel.onmessage = (ev: scwMessageEvent) => {
        if (ev.data.type === MessageType.Invoice) {
          resolve(ev.data);
        } else {
          // todo: fallback to L1 payment ?
          reject(new Error("Unexpected message type"));
        }
      };
    });

    // create a state update with the hashlock
    const signedUpdate = await this.addHTLC(amount, invoice.hashLock);

    // send the state update to the intermediary
    this.sendPeerMessage({
      type: MessageType.ForwardPayment,
      target: payee,
      amount,
      hashLock: invoice.hashLock,
      timelock: 0, // todo
      updatedState: signedUpdate,
    });
  }

  // Create L1 payment UserOperation and forward to intermediary
  async payL1(payee: string, amount: number): Promise<void> {
    // Only need to encode 'to' and 'amount' fields (i.e. no 'data') for basic eth transfer
    const callData = account.encodeFunctionData("execute", [
      payee,
      ethers.parseEther(amount.toString()),
    ]);
    const partialUserOp: Partial<UserOperationStruct> = {
      sender: this.signer.address,
      callData,
    };
    const userOp = fillUserOpDefaults(partialUserOp);
    const signature = await this.signUserOperation(userOp);
    const signedUserOp: UserOperationStruct = {
      ...userOp,
      signature,
    };
    this.sendPeerMessage({
      type: MessageType.UserOperation,
      ...signedUserOp,
    });
  }

  // todo: add listener for invoice requests (always accept - they want to pay us)

  // todo: add listener for incoming HTLCs which correspond to some preimage we know.
  //       When they arrive, we claim the funds and maybe clear the invoice in some way.
}
