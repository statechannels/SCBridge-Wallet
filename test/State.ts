import {
  type BaseWallet,
  getBytes,
  AbiCoder,
  type ParamType,
  keccak256,
} from "ethers";

import {
  ecsign,
  toRpcSig,
  keccak256 as keccak256_buffer,
} from "ethereumjs-util";
import { type StateStruct } from "../typechain-types/Nitro-SCW.sol/NitroSmartContractWallet";

export function signStateHash(
  stateHash: string,
  owner: BaseWallet,
  intermediary: BaseWallet,
): [string, string] {
  const msg1 = Buffer.concat([
    Buffer.from("\x19Ethereum Signed Message:\n32", "ascii"),
    Buffer.from(getBytes(stateHash)),
  ]);

  const ownerSig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(getBytes(owner.privateKey)),
  );
  const intermediarySig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(getBytes(intermediary.privateKey)),
  );

  return [
    toRpcSig(ownerSig.v, ownerSig.r, ownerSig.s),
    toRpcSig(intermediarySig.v, intermediarySig.r, intermediarySig.s),
  ];
}

export function encodeState(state: StateStruct): string {
  const ABI = [
    {
      type: "tuple",
      components: [
        { name: "owner", type: "address" },
        {
          name: "intermediary",
          type: "address",
        },
        {
          name: "turnNum",
          type: "uint",
        },
        {
          name: "intermediaryBalance",
          type: "uint",
        },
        {
          type: "tuple[]",
          name: "htlcs",
          components: [
            { name: "to", type: "uint8" },
            { name: "amount", type: "uint" },
            { name: "hashLock", type: "bytes32" },
            { name: "timelock", type: "uint" },
          ],
        } as any as ParamType,
      ],
    } as any as ParamType,
  ];

  return AbiCoder.defaultAbiCoder().encode(ABI, [state]);
}

export function hashState(state: StateStruct): string {
  const encodedState = encodeState(state);
  return keccak256(encodedState);
}
