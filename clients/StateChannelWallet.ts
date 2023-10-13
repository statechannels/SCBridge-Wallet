import { ethers } from 'ethers'
import { type UserOperationStruct } from '../typechain-types/Nitro-SCW.sol/NitroSmartContractWallet'
import { signUserOp } from '../test/UserOp'

export class StateChannelWallet {
  private readonly chainProvider: ethers.Provider
  private readonly signer: ethers.Wallet
  private readonly entrypointAddress: string

  constructor (params: { signingKey: string, chainRpcUrl: string, entryPointAddress: string }) {
    this.entrypointAddress = params.entryPointAddress
    this.chainProvider = new ethers.JsonRpcProvider(params.chainRpcUrl)

    const wallet = new ethers.Wallet(params.signingKey)
    this.signer = wallet.connect(this.chainProvider)
  }

  async getCurrentBlockNumber (): Promise<number> {
    try {
      const blockNumber = await this.chainProvider.getBlockNumber()
      return blockNumber
    } catch (error: any) {
      throw new Error(`Error fetching block number: ${error.message}`)
    }
  }

  async signUserOperation (userOp: UserOperationStruct): Promise<string> {
    const network = await this.chainProvider.getNetwork()
    const signature = signUserOp(userOp, this.signer, this.entrypointAddress, Number(network.chainId))
    return signature
  }

  // payL2(address, amount, hash); // use the hash to craft an HTLC, put it inside a state, sign and returns it
  // ingestSignedStateAndPreimage(signedState, preimage); // returns a signed state with updated balances and one fewer HTLC
}
