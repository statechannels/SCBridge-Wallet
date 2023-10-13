import {
  type BaseWallet,
  getBytes,
  AbiCoder,
  type ParamType,
  keccak256
} from 'ethers'

import {
  ecsign,
  toRpcSig,
  keccak256 as keccak256_buffer
} from 'ethereumjs-util'
import { type StateStruct } from '../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet'

export function signStateHash (
  stateHash: string,
  owner: BaseWallet,
  intermediary: BaseWallet
): [string, string] {
  const msg1 = Buffer.concat([
    Buffer.from('\x19Ethereum Signed Message:\n32', 'ascii'),
    Buffer.from(getBytes(stateHash))
  ])

  const ownerSig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(getBytes(owner.privateKey))
  )
  const intermediarySig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(getBytes(intermediary.privateKey))
  )

  return [
    toRpcSig(ownerSig.v, ownerSig.r, ownerSig.s),
    toRpcSig(intermediarySig.v, intermediarySig.r, intermediarySig.s)
  ]
}

function encodeState (state: StateStruct): string {
  const { owner, intermediary, turnNum, intermediaryBalance, htlcs } = state
  return AbiCoder.defaultAbiCoder().encode(
    [
      'address',
      'address',
      'uint64',
      {
        type: 'tuple[]',
        components: ['address', 'uint256', 'bytes', 'uint256']
      } as any as ParamType
    ],
    [owner, intermediary, turnNum, intermediaryBalance, htlcs]
  )
}

export function hashState (state: StateStruct): string {
  const encodedState = encodeState(state)
  return keccak256(encodedState)
}
