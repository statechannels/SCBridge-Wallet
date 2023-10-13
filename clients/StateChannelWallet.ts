import { ethers } from 'ethers'
import { type UserOperationStruct, type HTLCStruct, type StateStruct } from '../typechain-types/Nitro-SCW.sol/NitroSmartContractWallet'
import { signUserOp } from '../test/UserOp'
import { NitroSmartContractWallet__factory } from '../typechain-types'

const HTLC_TIMEOUT = 5 * 60 // 5 minutes

export class StateChannelWallet {
  private readonly chainProvider: ethers.Provider
  private readonly signer: ethers.Wallet
  private readonly entrypointAddress: string
  private readonly scwAddress: string
  private readonly hashStore: Map<string, Uint8Array> // maps hash-->preimage

  constructor (params: { signingKey: string, chainRpcUrl: string, entrypointAddress: string, scwAddress: string }) {
    this.hashStore = new Map<string, Uint8Array>()
    this.entrypointAddress = params.entrypointAddress
    this.scwAddress = params.scwAddress
    this.chainProvider = new ethers.JsonRpcProvider(params.chainRpcUrl)

    const wallet = new ethers.Wallet(params.signingKey)
    this.signer = wallet.connect(this.chainProvider)
  }

  async getCurrentBlockNumber (): Promise<number> {
    const blockNumber = await this.chainProvider.getBlockNumber()
    return blockNumber
  }

  async signUserOperation (userOp: UserOperationStruct): Promise<string> {
    const network = await this.chainProvider.getNetwork()
    const signature = signUserOp(userOp, this.signer, this.entrypointAddress, Number(network.chainId))
    return signature
  }

  async createNewHash (): Promise<string> {
    const preimage = ethers.randomBytes(32)
    const hash = ethers.keccak256(preimage)
    this.hashStore.set(hash, preimage)
    return hash
  }

  // Craft an HTLC struct, put it inside a state, hash the state, sign and return it
  async createHTLCPayment (toAddress: string, amount: number, hash: string): Promise<string> {
    const currentTimestamp: number = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    const htlc: HTLCStruct = {
      to: toAddress,
      amount,
      hashLock: hash,
      timelock: currentTimestamp + HTLC_TIMEOUT * 2 // payment creator always uses TIMEOUT * 2
    }

    const scw = NitroSmartContractWallet__factory.connect(this.scwAddress, this.chainProvider)
    const intermediaryAddress = await scw.intermediary()
    const intermediaryBalance = await scw.intermediaryBalance()

    const htlcState: StateStruct = {
      owner: this.signer.address,
      intermediary: intermediaryAddress,
      turnNum: 0,
      intermediaryBalance,
      htlcs: [htlc]
    }

    const stateHash = await scw.getStateHash(htlcState)
    const signature = await this.signer.signMessage(stateHash)
    return signature
  }
  // ingestSignedStateAndPreimage(signedState, preimage); // returns a signed state with updated balances and one fewer HTLC
}
