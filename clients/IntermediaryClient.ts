import { ethers } from "ethers";
import {
  type scwMessageEvent,
  MessageType,
  type ForwardPaymentRequest,
  type Message,
} from "./Messages";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";
import { type UserOperationStruct } from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";

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

  /**
   * forwardHTLC moves a payment across the network. It is called by a channelWallet who has
   * verified that the payment is safe to forward.
   *
   * @param htlc the HTLC to forward
   */
  async forwardHTLC(htlc: ForwardPaymentRequest): Promise<Message | undefined> {
    // Locate the target client
    const targetClient = this.channelClients.find(
      (c) => c.getAddress() === htlc.target,
    );

    if (targetClient === undefined) {
      throw new Error("Target not found");
      // todo: return a failure message to the sender?
    }

    const fee = 0; // for example
    const updatedState = await targetClient.addHTLC(
      htlc.amount - fee,
      htlc.hashLock,
    );

    return {
      type: MessageType.ForwardPayment,
      target: htlc.target,
      amount: htlc.amount,
      hashLock: htlc.hashLock,
      timelock: 0, // todo
      updatedState,
    };
  }
}

export class IntermediaryClient extends StateChannelWallet {
  private coordinator: IntermediaryCoordinator = new IntermediaryCoordinator(
    [],
  );

  public registerCoordinator(coordinator: IntermediaryCoordinator): void {
    this.coordinator = coordinator;
  }

  public async receiveMessage(
    ev: scwMessageEvent,
  ): Promise<Message | undefined> {
    // peer channel
    const req = ev.data;

    switch (req.type) {
      case MessageType.ForwardPayment:
        // todo: more robust checks. EG: signature of counterparty
        if (req.amount > (await this.getOwnerBalance())) {
          throw new Error("Insufficient balance");
        }
        return await this.coordinator.forwardHTLC(req);
      case MessageType.UserOperation:
        return await this.handleUserOp(req);

      default:
        throw new Error(`Message type ${req.type} not yet handled`);
    }
  }

  private async handleUserOp(
    userOp: UserOperationStruct,
  ): Promise<Message | undefined> {
    // TODO: Decode the calldata of the user op and only sign if the amount transferred is under intermediaryBalance

    const ownerSig = userOp.signature.slice(0, 65);
    const intermediarySig = await this.signUserOperation(userOp);
    userOp.signature = ethers.concat([ownerSig, intermediarySig]);

    await this.entrypointContract.handleOps([userOp], this.getAddress());
    return undefined; // TODO: Return a transaction receipt to the owner
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
