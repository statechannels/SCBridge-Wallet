import { ethers } from 'ethers';
import { UserOperation } from './types';

export class StateChannelWallet {
  private intermediaryUrl: string;
  private chainProvider: ethers.providers.JsonRpcProvider;
  private signer: ethers.Wallet;

  constructor(params: { signingKey: string; chainRpcUrl: string; intermediaryUrl: string }) {
    this.intermediaryUrl = params.intermediaryUrl;

    this.chainProvider = new ethers.providers.JsonRpcProvider(params.chainRpcUrl);

    const wallet = new ethers.Wallet(params.signingKey);
    this.signer = wallet.connect(this.chainProvider);
  }

  async getCurrentBlockNumber(): Promise<number> {
    try {
      const blockNumber = this.chainProvider.getBlockNumber();
      return blockNumber;
    } catch (error: any) {
      throw new Error(`Error fetching block number: ${error.message}`);
    }
  }

  async signUserOperation(userOp: UserOperation): Promise<UserOperation> {
    // Serialize the UserOperation into bytes
    const serialized = ethers.utils.concat([
      ethers.utils.arrayify(userOp.sender),
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.nonce)),
      userOp.initCode,
      userOp.callData,
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.callGasLimit)),
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.verificationGasLimit)),
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.preVerificationGas)),
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.maxFeePerGas)),
      ethers.utils.arrayify(ethers.BigNumber.from(userOp.maxPriorityFeePerGas)),
      userOp.paymasterAndData
    ]);

    // keccak256 hash the serialized bytes then sign the hash
    const hash = ethers.utils.keccak256(serialized);
    const signature = await this.signer.signMessage(ethers.utils.arrayify(hash));

    // Append the signature to the user operation
    userOp.signature = ethers.utils.arrayify(signature);

    return userOp;
  }

  //payL2(address, amount, hash); // use the hash to craft an HTLC, puts it inside a state, sign and returns it
  //ingestSignedStateAndPreimage(signedState, preimage); // returns a signed state with updated balances and one fewer HTLC
}
