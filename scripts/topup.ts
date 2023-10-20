import { ethers } from "hardhat";
import dotenv from "dotenv";

import { type HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function main(): Promise<void> {
  dotenv.config();
  const aliceSCWAddress = process.env.VITE_ALICE_SCW_ADDRESS ?? "";
  const bobSCWAddress = process.env.VITE_BOB_SCW_ADDRESS ?? "";

  const ireneAddress = process.env.VITE_IRENE_ADDRESS ?? "";

  const fundingAmount = BigInt(process.env.VITE_SCW_DEPOSIT ?? "");
  const hardhatFundedAccount = (await ethers.getSigners())[0];
  await fundTo(
    [aliceSCWAddress, bobSCWAddress, ireneAddress],
    fundingAmount,
    hardhatFundedAccount,
  );
}

async function fundTo(
  addresses: string[],
  amount: bigint,
  fundedAccount: HardhatEthersSigner,
): Promise<void> {
  for (const address of addresses) {
    const balance = await ethers.provider.getBalance(address);
    if (balance >= amount) {
      console.log(
        `Skipping funding ${address} it already has ${ethers.formatEther(
          amount,
        )} ETH`,
      );
      continue;
    }

    const amountToFund = amount - balance;
    console.log(
      `Funding ${address} with ${ethers.formatEther(
        amountToFund,
      )} ETH to reach ${ethers.formatEther(amount)} ETH`,
    );
    await (
      await fundedAccount.sendTransaction({
        to: address,
        value: amountToFund,
      })
    ).wait();
  }
}
void main();
