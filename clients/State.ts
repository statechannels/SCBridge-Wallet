import {
  type BaseWallet,
  AbiCoder,
  type ParamType,
  keccak256,
  getBytes,
} from "ethers";

import { type StateStruct } from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";

export async function signStateHash(
  stateHash: string,
  owner: BaseWallet,
  intermediary: BaseWallet,
): Promise<[string, string]> {
  const ownerSig = await owner.signMessage(getBytes(stateHash));
  const intermediarySig = await intermediary.signMessage(getBytes(stateHash));

  return [ownerSig, intermediarySig];
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
