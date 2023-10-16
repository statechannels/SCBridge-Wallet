import {
  type Invoice,
  type scwMessageEvent,
  MessageType,
  type Message,
  type GlobalMessage,
} from "./Messages";
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
  public async receiveMessage(
    ev: scwMessageEvent,
  ): Promise<Message | GlobalMessage | undefined> {
    const req = ev.data;
    console.log("received message: " + JSON.stringify(req));

    switch (req.type) {
      case MessageType.RequestInvoice: {
        const hash = await this.createNewHash();
        const invoice: Invoice = {
          type: MessageType.Invoice,
          hashLock: hash,
          amount: req.amount,
          from: this.ownerAddress,
        };
        return { to: req.from, message: invoice };
      }
      case MessageType.Invoice: {
        // create a state update with the hashlock
        const signedUpdate = await this.addHTLC(req.amount, req.hashLock);

        return {
          to: req.from,
          message: {
            type: MessageType.ForwardPayment,
            target: req.from,
            amount: req.amount,
            hashLock: req.hashLock,
            timelock: 0, // todo
            updatedState: signedUpdate,
          },
        };
      }
      default:
        return undefined;
    }
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
  async pay(
    payee: string,
    amount: number,
  ): Promise<Message | GlobalMessage | undefined> {
    // contact `payee` and request a hashlock
    return {
      to: payee,
      message: {
        type: MessageType.RequestInvoice,
        amount,
        from: this.ownerAddress,
      },
    };
  }

  // Create L1 payment UserOperation and forward to intermediary
  async payL1(payee: string, amount: number): Promise<Message | undefined> {
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
    return {
      type: MessageType.UserOperation,
      ...signedUserOp,
    };
  }

  // todo: add listener for invoice requests (always accept - they want to pay us)

  // todo: add listener for incoming HTLCs which correspond to some preimage we know.
  //       When they arrive, we claim the funds and maybe clear the invoice in some way.
}
