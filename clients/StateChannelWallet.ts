import { ethers, getBytes } from "ethers";
import {
  type UserOperationStruct,
  type HTLCStruct,
  type StateStruct,
  type SCBridgeWallet,
} from "../typechain-types/contracts/SCBridgeWallet";
import { signUserOp } from "./UserOp";
import {
  type EntryPoint,
  EntryPoint__factory,
  SCBridgeWallet__factory,
} from "../typechain-types";
import {
  type scwMessageEvent,
  type Message,
  type SignatureMessage,
  MessageType,
} from "./Messages";
import { hashState, logState } from "./State";

const HTLC_TIMEOUT = 5 * 60; // 5 minutes

export enum Participant {
  Owner = 0,
  Intermediary = 1,
}

export interface StateChannelWalletParams {
  signingKey: string;
  ownerAddress: string;
  intermediaryAddress: string;
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
  ownerAddress: string;
  intermediaryAddress: string;
  protected readonly scBridgeWalletAddress: string;
  protected readonly scwContract: SCBridgeWallet;
  protected readonly entrypointContract: EntryPoint;
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
    this.scBridgeWalletAddress = params.scwAddress;
    this.ownerAddress = params.ownerAddress;

    this.chainProvider = new ethers.JsonRpcProvider(params.chainRpcUrl);
    this.peerBroadcastChannel = new BroadcastChannel(
      this.ownerAddress + "-peer",
    );
    this.globalBroadcastChannel = new BroadcastChannel(
      this.ownerAddress + "-global",
    );

    const wallet = new ethers.Wallet(params.signingKey);
    this.signer = wallet.connect(this.chainProvider);

    this.entrypointContract = EntryPoint__factory.connect(
      this.entrypointAddress,
      this.signer,
    );

    this.scwContract = SCBridgeWallet__factory.connect(
      this.scBridgeWalletAddress,
      this.chainProvider,
    );

    this.intermediaryAddress = params.intermediaryAddress;

    const computedAddress = new ethers.Wallet(params.signingKey).address;
    if (
      this.ownerAddress !== computedAddress &&
      this.intermediaryAddress !== computedAddress
    ) {
      throw Error("secret key does not correspond to owner nor intermediary");
    }
  }

  static async create(
    params: StateChannelWalletParams,
  ): Promise<StateChannelWallet> {
    const instance = new StateChannelWallet(params);

    await StateChannelWallet.hydrateWithChainData(instance);
    return instance;
  }

  public addSignedState(ss: SignedState): void {
    // todo: recover signers and throw if invalid
    console.log("adding signed state");
    logState(ss.state);

    this.signedStates.push(ss);
  }

  protected static async hydrateWithChainData(
    instance: StateChannelWallet,
  ): Promise<void> {
    instance.intermediaryAddress = await instance.scwContract.intermediary();
    instance.ownerAddress = await instance.scwContract.owner();
  }

  /**
   * used to return a co-signature on proposed updates.
   *
   * @param signature the signature to send to the peer
   */
  protected ack(signature: string): void {
    const ackPipe = new BroadcastChannel(this.scBridgeWalletAddress + "-ack");
    ackPipe.postMessage({
      type: MessageType.Signature,
      signature,
    });
  }

  async sendPeerMessage(message: Message): Promise<SignatureMessage> {
    const ackPipe = new BroadcastChannel(this.scBridgeWalletAddress + "-ack");

    const resp = new Promise<SignatureMessage>((resolve, reject) => {
      ackPipe.onmessage = (ev: scwMessageEvent) => {
        if (ev.data.type === MessageType.Signature) {
          resolve(ev.data);
        } else {
          reject(
            new Error(`Unexpected message type: ${JSON.stringify(ev.data)}`),
          );
        }
      };
    });

    this.peerBroadcastChannel.postMessage(message);

    return await resp;
  }

  /**
   * Sends a message to a network participant who is *not* our channel peer, waits
   * for a response, and returns the response. It is the responsibility of receiving
   * peers to respond to messages sent via this method.
   *
   * @param to the scwAddress of the recipient
   * @param message the protocol message to send
   * @returns the response from the recipient
   */
  async sendGlobalMessage(to: string, message: Message): Promise<Message> {
    const toChannel = new BroadcastChannel(to + "-global");

    // todo: (out of scope) create a request-scoped broadcastChannel for the response,
    //       to avoid accidentally returning an unrelated message (e.g. from a previous interaction)
    //       Should not be an issue for demo purposes

    const respPromise = new Promise<Message>((resolve, reject) => {
      // todo: fail on timeout
      toChannel.onmessage = (ev: scwMessageEvent) => {
        resolve(ev.data);
      };
    });

    toChannel.postMessage(message);

    return await respPromise;
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

  /**
   * @returns the contract address of the SC bridge wallet.
   */
  getAddress(): string {
    return this.scBridgeWalletAddress;
  }

  /**
   * getBalance checks the blockchain for the current balance of the wallet.
   */
  async getBalance(): Promise<bigint> {
    return await this.chainProvider.getBalance(this.scBridgeWalletAddress);
  }

  get intermediaryBalance(): bigint {
    return BigInt(this.currentState().intermediaryBalance);
  }

  async getOwnerBalance(): Promise<bigint> {
    const walletBalance = await this.getBalance();
    return walletBalance - this.intermediaryBalance;
  }

  async getCurrentBlockNumber(): Promise<number> {
    const blockNumber = await this.chainProvider.getBlockNumber();
    return blockNumber;
  }

  async signUserOperation(
    userOp: UserOperationStruct,
  ): Promise<{ signature: string; hash: string }> {
    const network = await this.chainProvider.getNetwork();
    const { signature, hash } = signUserOp(
      userOp,
      this.signer,
      this.entrypointAddress,
      Number(network.chainId),
    );
    return { signature, hash };
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
        signedState.intermediarySignature !== "" ||
        signedState.ownerSignature !== ""
      ) {
        // todo: deep copy?
        return signedState.state;
      }
    }

    // throw new Error("No signed state found");
    return {
      turnNum: 0,
      owner: this.ownerAddress,
      intermediary: this.intermediaryAddress,
      intermediaryBalance: BigInt(ethers.parseEther("5")),
      htlcs: [],
    };
  }

  signState(s: StateStruct): SignedState {
    const stateHash = hashState(s);
    const signature: string = this.signer.signMessageSync(getBytes(stateHash));

    const signedState: SignedState = {
      state: s,
      ownerSignature: this.myRole() === Participant.Owner ? signature : "",
      intermediarySignature:
        this.myRole() === Participant.Intermediary ? signature : "",
    };

    return signedState;
  }

  // Craft an HTLC struct, put it inside a state, hash the state, sign and return it
  addHTLC(amount: bigint, hash: string): SignedState {
    const currentTimestamp: number = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    if (this.myRole() === Participant.Intermediary) {
      if (Number(this.currentState().intermediaryBalance) < BigInt(amount)) {
        throw new Error("Insufficient balance");
      }
    }

    if (
      this.myRole() === Participant.Owner &&
      Number(this.getOwnerBalance()) < BigInt(amount)
    ) {
      throw new Error("Insufficient balance");
    }

    const htlc: HTLCStruct = {
      to: this.theirRole(),
      amount: BigInt(amount),
      hashLock: hash,
      timelock: currentTimestamp + HTLC_TIMEOUT * 2, // payment creator always uses TIMEOUT * 2
    };

    const updatedIntermediaryBalance =
      this.myRole() === Participant.Intermediary
        ? BigInt(this.currentState().intermediaryBalance) - amount
        : this.currentState().intermediaryBalance;

    const updated: StateStruct = {
      owner: this.ownerAddress,
      intermediary: this.intermediaryAddress,
      turnNum: Number(this.currentState().turnNum) + 1,
      intermediaryBalance: BigInt(updatedIntermediaryBalance),
      htlcs: [...this.currentState().htlcs, htlc],
    };

    return this.signState(updated);
  }

  async unlockHTLC(preimage: Uint8Array): Promise<SignedState> {
    // hash the preimage w/ keccak256 and sha256
    const ethHash = ethers.keccak256(preimage);
    const lnHash = ethers.sha256(preimage);

    // check if any existing HTLCs match the hash
    const unlockTarget = this.currentState().htlcs.find(
      (h) => h.hashLock === ethHash || h.hashLock === lnHash,
    );

    // with well-behaved clients, we should not see this
    if (unlockTarget === undefined) {
      logState(this.currentState());
      throw new Error("No matching HTLC found");
    }

    // check if the HTLC is expired - this should not happen
    if (Number(unlockTarget.timelock) < Math.floor(Date.now() / 1000)) {
      throw new Error("HTLC is expired");
    }

    // update balance of the party that sent the HTLC. If the HTLC is for
    // the owner, then the released funds implicitly return to them. If
    // the HTLC is for the intermediary, then the update must be recorded.
    let newintermediaryBalance = this.intermediaryBalance;
    if (unlockTarget.to === Participant.Intermediary) {
      newintermediaryBalance += BigInt(unlockTarget.amount);
    }

    const updated: StateStruct = {
      intermediary: this.intermediaryAddress,
      owner: this.ownerAddress,
      turnNum: Number(this.currentState().turnNum) + 1,
      intermediaryBalance: newintermediaryBalance,
      htlcs: this.currentState().htlcs.filter((h) => h !== unlockTarget),
    };

    return this.signState(updated);
  }
}
