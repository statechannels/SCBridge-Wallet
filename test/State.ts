import { type BaseWallet, getBytes } from 'ethers'

import { ecsign, toRpcSig, keccak256 as keccak256_buffer } from 'ethereumjs-util'
import { type StateStruct } from '../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet'

export function signStateHash (stateHash: string, owner: BaseWallet, intermediary: BaseWallet): [string, string] {
  const msg1 = Buffer.concat([
    Buffer.from('\x19Ethereum Signed Message:\n32', 'ascii'),
    Buffer.from(getBytes(stateHash))
  ])

  const ownerSig = ecsign(keccak256_buffer(msg1), Buffer.from(getBytes(owner.privateKey)))
  const intermediarySig = ecsign(keccak256_buffer(msg1), Buffer.from(getBytes(intermediary.privateKey)))

  return [toRpcSig(ownerSig.v, ownerSig.r, ownerSig.s), toRpcSig(intermediarySig.v, intermediarySig.r, intermediarySig.s)]
}

export function hashState (state: StateStruct): string {
  throw new Error('TODO:Figure out how to get correct the hash of the state')
  //   const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  //     ['address', 'address', 'uint64', 'tuple(uint256,bytes32,uint256)[]'],
  //     [state.owner, state.intermediary, state.turnNum, state.htlcs.map(htlc => [htlc.amount, htlc.hashLock, htlc.timelock])])

//   return ethers.keccak256(encoded)
}
