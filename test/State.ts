import { type BaseWallet, getBytes } from 'ethers'

import { ecsign, toRpcSig, keccak256 as keccak256_buffer } from 'ethereumjs-util'

export function signStateHash (stateHash: string, owner: BaseWallet, intermediary: BaseWallet): [string, string] {
  const msg1 = Buffer.concat([
    Buffer.from('\x19Ethereum Signed Message:\n32', 'ascii'),
    Buffer.from(getBytes(stateHash))
  ])

  const ownerSig = ecsign(keccak256_buffer(msg1), Buffer.from(getBytes(owner.privateKey)))
  const intermediarySig = ecsign(keccak256_buffer(msg1), Buffer.from(getBytes(intermediary.privateKey)))

  return [toRpcSig(ownerSig.v, ownerSig.r, ownerSig.s), toRpcSig(intermediarySig.v, intermediarySig.r, intermediarySig.s)]
}
