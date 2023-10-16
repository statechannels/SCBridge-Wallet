import { type Invoice, type scwMessageEvent, MessageType } from "./Messages";
import {
  Participant,
  StateChannelWallet,
  type StateChannelWalletParams,
} from "./StateChannelWallet";

export class IntermediaryClient extends StateChannelWallet {
    constructor(params: StateChannelWalletParams) {
      super(params);
      this.attachMessageHandlers
    }
    private attachMessageHandlers(): void {
        // global channel
        // todo: add listener for incoming HTLCs which correspond to some preimage we know.


        // peer channel
        // todo: add listener for HTLCs that the channel owner wants us to forward
        // todo: add listener for UserOperations that the channel owner wants us to forward to L1
    }

  static async create(params: StateChannelWalletParams): Promise<IntermediaryClient> {
    const instance = new IntermediaryClient(params);

    if (instance.myRole() !== Participant.Intermediary) {
      throw new Error("Signer is not owner");
    }

    await IntermediaryClient.hydrateWithChainData(instance);
    return instance;
  }
  
}
