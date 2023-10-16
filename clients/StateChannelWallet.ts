import { ethers } from "ethers";
import {
  type UserOperationStruct,
  type HTLCStruct,
  type StateStruct,
  type NitroSmartContractWallet,
} from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";
import { signUserOp } from "./UserOp";
import { NitroSmartContractWallet__factory } from "../typechain-types";
import { type Message } from "./Messages";
import { hashState } from "../test/State";

const HTLC_TIMEOUT = 5 * 60; // 5 minutes

export enum Participant {
  Owner = 0,
  Intermediary = 1,
}

export interface StateChannelWalletParams {
  signingKey: string;
  chainRpcUrl: string;
  entrypointAddress: string;
  scwAddress: string;
}

export interface SignedState {
  state: StateStruct;
  ownerSignature: string;
  intermediarySignature: string;
}

export class StateChannelWallet {
  protected readonly chainProvider: ethers.Provider;
  protected readonly signer: ethers.Wallet;
  protected readonly entrypointAddress: string;
  protected ownerAddress: string;
  protected intermediaryAddress: string;
  protected intermediaryBalance: bigint;
  protected readonly scwAddress: string;
  protected readonly contract: NitroSmartContractWallet;
  protected readonly hashStore: Map<string, Uint8Array>; // maps hash-->preimage
  protected readonly peerBroadcastChannel: BroadcastChannel;
  protected readonly globalBroadcastChannel: BroadcastChannel;
  /**
   * Signed states are stored as long as they are deemed useful. All stored
   * signatures are valid.
   */
  protected signedStates: SignedState[] = [];

  constructor(params: StateChannelWalletParams) {
    this.hashStore = new Map<string, Uint8Array>();
    this.entrypointAddress = params.entrypointAddress;
    this.scwAddress = params.scwAddress;
    this.chainProvider = new ethers.JsonRpcProvider(params.chainRpcUrl);
    this.peerBroadcastChannel = new BroadcastChannel(this.scwAddress + "-peer");
    this.globalBroadcastChannel = new BroadcastChannel(
      this.scwAddress + "-global",
    );

    const wallet = new ethers.Wallet(params.signingKey);
    this.signer = wallet.connect(this.chainProvider);

    this.contract = NitroSmartContractWallet__factory.connect(
      this.scwAddress,
      this.chainProvider,
    );

    // These values should be set in 'create' method
    this.ownerAddress = "0x0";
    this.intermediaryAddress = "0x0";
    this.intermediaryBalance = BigInt(0);
  }

  static async create(
    params: StateChannelWalletParams,
  ): Promise<StateChannelWallet> {
    const instance = new StateChannelWallet(params);

    await StateChannelWallet.hydrateWithChainData(instance);
    return instance;
  }

  protected static async hydrateWithChainData(instance: StateChannelWallet) {
    instance.intermediaryAddress = await instance.contract.intermediary();
    instance.intermediaryBalance =
      await instance.contract.intermediaryBalance();
    instance.ownerAddress = await instance.contract.owner();
  }

  sendPeerMessage(message: Message): void {
    this.peerBroadcastChannel.postMessage(message);
  }

  myRole(): Participant {
    if (this.signer.address === this.ownerAddress) {
      return Participant.Owner;
    } else if (this.signer.address === this.intermediaryAddress) {
      return Participant.Intermediary;
    } else {
      throw new Error("Signer is neither owner nor intermediary");
    }
  }

  theirRole(): Participant {
    if (this.myRole() === Participant.Owner) {
      return Participant.Intermediary;
    } else {
      return Participant.Owner;
    }
  }

  async getBalance(): Promise<number> {
    // todo: caching, block event based updating, etc
    const balance = await this.chainProvider.getBalance(this.scwAddress);
    const balanceEther = ethers.formatEther(balance);
    return Number(balanceEther);
  }

  async getIntermediaryBalance(): Promise<number> {
    return Number(this.intermediaryBalance);
  }

  async getOwnerBalance(): Promise<number> {
    const walletBalance = await this.getBalance();
    return walletBalance - (await this.getIntermediaryBalance());
  }

  async getCurrentBlockNumber(): Promise<number> {
    const blockNumber = await this.chainProvider.getBlockNumber();
    return blockNumber;
  }

  async signUserOperation(userOp: UserOperationStruct): Promise<string> {
    const network = await this.chainProvider.getNetwork();
    const signature = signUserOp(
      userOp,
      this.signer,
      this.entrypointAddress,
      Number(network.chainId),
    );
    return signature;
  }

  async createNewHash(): Promise<string> {
    const preimage = ethers.randomBytes(32);
    const hash = ethers.keccak256(preimage);
    this.hashStore.set(hash, preimage);
    return hash;
  }

  // returns the state with largest turnNum that is signed by both parties
  currentState(): StateStruct {
    for (let i = this.signedStates.length - 1; i >= 0; i--) {
      const signedState = this.signedStates[i];
      if (
        signedState.intermediarySignature !== "" &&
        signedState.ownerSignature !== ""
      ) {
        return signedState.state;
      }
    }
    throw new Error("No signed state found");
  }

  // Craft an HTLC struct, put it inside a state, hash the state, sign and return it
  async addHTLC(amount: number, hash: string): Promise<SignedState> {
    const currentTimestamp: number = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    if (
      this.myRole() === Participant.Intermediary &&
      this.intermediaryBalance < BigInt(amount)
    ) {
      throw new Error("Insufficient balance");
    }

    if (
      this.myRole() === Participant.Owner &&
      Number(this.getOwnerBalance()) < BigInt(amount)
    ) {
      throw new Error("Insufficient balance");
    }

    const htlc: HTLCStruct = {
      to: this.theirRole(),
      amount,
      hashLock: hash,
      timelock: currentTimestamp + HTLC_TIMEOUT * 2, // payment creator always uses TIMEOUT * 2
    };

    const updated: StateStruct = {
      owner: this.ownerAddress,
      intermediary: this.intermediaryAddress,
      turnNum: Number(this.currentState().turnNum) + 1,
      intermediaryBalance: this.intermediaryBalance,
      htlcs: [...this.currentState().htlcs, htlc],
    };

    const stateHash = await hashState(updated);
    const signature = await this.signer.signMessage(stateHash);

    const signedState: SignedState = {
      state: updated,
      ownerSignature: this.myRole() === Participant.Owner ? signature : "",
      intermediarySignature:
        this.myRole() === Participant.Intermediary ? signature : "",
    };

    return signedState;
  }
  // ingestSignedStateAndPreimage(signedState, preimage); // returns a signed state with updated balances and one fewer HTLC
}
