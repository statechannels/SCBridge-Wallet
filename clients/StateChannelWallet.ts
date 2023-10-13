import { ethers } from 'ethers'
import { type UserOperationStruct } from '../typechain-types/Nitro-SCW.sol/NitroSmartContractWallet'
import { signUserOp } from '../test/UserOp'

export class StateChannelWallet {
  private readonly chainProvider: ethers.Provider
  private readonly signer: ethers.Wallet
  private readonly entrypointAddress: string
  private readonly hashStore: Map<string, Uint8Array> // maps hash-->preimage

  constructor (params: { signingKey: string, chainRpcUrl: string, entryPointAddress: string }) {
    this.hashStore = new Map<string, Uint8Array>()
    this.entrypointAddress = params.entryPointAddress
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

  async generateHash (): Promise<string> {
    const preimage = ethers.randomBytes(32)
    const hash = ethers.keccak256(preimage)
    this.hashStore.set(hash, preimage)
    return hash
  }

  // Use the hash to craft an HTLC, put it inside a state, sign and return it
  // async payL2(address: string, amount: Number, hash: string) {}
  // ingestSignedStateAndPreimage(signedState, preimage); // returns a signed state with updated balances and one fewer HTLC
}
