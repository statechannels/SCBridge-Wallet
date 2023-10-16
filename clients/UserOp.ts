// FYI: Based on https://github.com/eth-infinitism/account-abstraction/blob/5b7b9715fa0c3743108982cf8826e6262fef6d68/test/UserOp.ts#L56-L105
import { AbiCoder, keccak256, getBytes, ZeroAddress } from "ethers";
import { type BaseWallet } from "ethers";

import { type UserOperationStruct } from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";

export function packUserOp(
  op: UserOperationStruct,
  forSignature = true,
): string {
  if (forSignature) {
    return AbiCoder.defaultAbiCoder().encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        keccak256(op.paymasterAndData),
      ],
    );
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return AbiCoder.defaultAbiCoder().encode(
      [
        "address",
        "uint256",
        "bytes",
        "bytes",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes",
        "bytes",
      ],
      [
        op.sender,
        op.nonce,
        op.initCode,
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData,
        op.signature,
      ],
    );
  }
}

export function packUserOp1(op: UserOperationStruct): string {
  return AbiCoder.defaultAbiCoder().encode(
    [
      "address", // sender
      "uint256", // nonce
      "bytes32", // initCode
      "bytes32", // callData
      "uint256", // callGasLimit
      "uint256", // verificationGasLimit
      "uint256", // preVerificationGas
      "uint256", // maxFeePerGas
      "uint256", // maxPriorityFeePerGas
      "bytes32", // paymasterAndData
    ],
    [
      op.sender,
      op.nonce,
      keccak256(op.initCode),
      keccak256(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      keccak256(op.paymasterAndData),
    ],
  );
}

export function getUserOpHash(
  op: UserOperationStruct,
  entryPoint: string,
  chainId: number,
): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId],
  );
  return keccak256(enc);
}

export const DefaultsForUserOp: UserOperationStruct = {
  sender: ZeroAddress,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: "0x",
  signature: "0x",
};

export function signUserOp(
  op: UserOperationStruct,
  signer: BaseWallet,
  entryPoint: string,
  chainId: number,
): string {
  const message = getUserOpHash(op, entryPoint, chainId);

  return signer.signMessageSync(getBytes(message));
}

export function fillUserOpDefaults(
  op: Partial<UserOperationStruct>,
  defaults = DefaultsForUserOp,
): UserOperationStruct {
  const partial: any = { ...op };
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete partial[key];
    }
  }
  const filled = { ...defaults, ...partial };
  return filled;
}
