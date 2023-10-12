export interface UserOperation {
  sender: string; // Ethereum addresses are usually represented as strings in TypeScript
  nonce: number | bigint;
  initCode: Uint8Array;
  callData: Uint8Array;
  callGasLimit: number | bigint;
  verificationGasLimit: number | bigint;
  preVerificationGas: number | bigint;
  maxFeePerGas: number | bigint;
  maxPriorityFeePerGas: number | bigint;
  paymasterAndData: Uint8Array;
  signature: Uint8Array;
}
