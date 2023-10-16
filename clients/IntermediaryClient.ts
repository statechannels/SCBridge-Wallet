import {
  type scwMessageEvent,
  MessageType,
  type ForwardPaymentRequest,
} from "./Messages";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";

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
  async forwardHTLC(htlc: ForwardPaymentRequest): Promise<void> {
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

    targetClient.sendPeerMessage({
      type: MessageType.ForwardPayment,
      target: htlc.target,
      amount: htlc.amount,
      hashLock: htlc.hashLock,
      timelock: 0, // todo
      updatedState,
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
    // global channel
    // todo: add listener for incoming HTLCs which correspond to some preimage we know.

    // peer channel
    // todo: add listener for HTLCs that the channel owner wants us to forward
    // todo: add listener for UserOperations that the channel owner wants us to forward to L1

    this.peerBroadcastChannel.onmessage = async (ev: scwMessageEvent) => {
      const req = ev.data;

      if (req.type === MessageType.ForwardPayment) {
        // todo: more robust checks. EG: signature of counterparty
        if (req.amount > (await this.getOwnerBalance())) {
          throw new Error("Insufficient balance");
        }
        void this.coordinator.forwardHTLC(req);
      }
    };
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
