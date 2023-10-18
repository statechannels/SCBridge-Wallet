import {
  type BaseWallet,
  AbiCoder,
  type ParamType,
  keccak256,
  getBytes,
} from "ethers";

import { type StateStruct } from "../typechain-types/contracts/SCBridgeWallet";

export function signStateHash(
  stateHash: string,
  owner: BaseWallet,
  intermediary: BaseWallet,
): [string, string] {
  return [
    owner.signMessageSync(getBytes(stateHash)),
    intermediary.signMessageSync(getBytes(stateHash)),
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

export function logState(s: StateStruct): void {
  console.log("State:");
  console.log(`  owner: ${s.owner as string}`);
  console.log(`  intermediary: ${s.intermediary as string}`);
  console.log(`  turnNum: ${s.turnNum}`);
  console.log(`  intermediaryBalance: ${Number(s.intermediaryBalance)}`);
  console.log(`  htlcs:`);
  s.htlcs.forEach((h) => {
    console.log(`    to: ${h.to}`);
    console.log(`    amount: ${h.amount}`);
    console.log(`    hashLock: ${h.hashLock.toString()}`);
    console.log(`    timelock: ${h.timelock}\n\n`);
  });
}

export function hashState(state: StateStruct): string {
  // logState(state);
  const encodedState = encodeState(state);
  return keccak256(encodedState);
}
