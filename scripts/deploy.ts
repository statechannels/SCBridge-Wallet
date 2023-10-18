import { ethers } from "hardhat";
import dotenv from "dotenv";
import { EntryPoint__factory } from "../typechain-types";
import { type HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const deployFunc = async function (): Promise<void> {
  dotenv.config();
  const hardhatFundedAccount = (await ethers.getSigners())[0];
  const startingBalance = await ethers.provider.getBalance(
    hardhatFundedAccount.address,
  );
  console.log(
    `Deployer (${hardhatFundedAccount.address}) starting balance ${startingBalance}`,
  );
  console.log("Starting deployment...");

  const aliceAddress = process.env.VITE_ALICE_ADDRESS ?? "";
  const bobAddress = process.env.VITE_BOB_ADDRESS ?? "";
  const ireneAddress = process.env.VITE_IRENE_ADDRESS ?? "";

  const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
  const entrypoint = await entryPointDeployer.deploy();
  const walletDeployer = await ethers.getContractFactory("SCBridgeWallet");
  console.log("EntryPoint deployed to:", await entrypoint.getAddress());

  const aliceWallet = await walletDeployer.deploy(
    aliceAddress,
    ireneAddress,
    await entrypoint.getAddress(),
  );

  console.log(
    `Alice (${aliceAddress?.slice(
      0,
      12,
    )}) SCBridgeWallet deployed to: ${await aliceWallet.getAddress()}`,
  );

  const bobWallet = await walletDeployer.deploy(
    bobAddress,
    ireneAddress,
    await entrypoint.getAddress(),
  );

  console.log(
    `Bob (${bobAddress?.slice(
      0,
      12,
    )}) SCBridgeWallet deployed to: ${await bobWallet.getAddress()}`,
  );

  const initialFunding = parseInt(process.env.VITE_SCW_DEPOSIT ?? "", 10);
  await fund(
    [await aliceWallet.getAddress(), await bobWallet.getAddress()],
    BigInt(initialFunding),
    hardhatFundedAccount,
  );
  // Fund irene with a smaller amount to pay for gas
  await fund([ireneAddress], BigInt(initialFunding / 10), hardhatFundedAccount);

  // Fund the Entrypoint to pay for gas for the SCWs
  await fundEntryPoint(
    [await aliceWallet.getAddress(), await bobWallet.getAddress()],
    BigInt(initialFunding / 10),
    await entrypoint.getAddress(),
    hardhatFundedAccount,
  );
  console.log("Deployment complete!");
};

async function fundEntryPoint(
  addresses: string[],
  amount: bigint,
  entryPointAddress: string,
  fundedAccount: HardhatEthersSigner,
): Promise<void> {
  for (const address of addresses) {
    console.log(`Funding EntryPoint for ${address} with ${amount.toString()}`);
    await EntryPoint__factory.connect(
      entryPointAddress,
      fundedAccount,
    ).depositTo(address, { value: amount });
  }
}
async function fund(
  addresses: string[],
  amount: bigint,
  fundedAccount: HardhatEthersSigner,
): Promise<void> {
  for (const address of addresses) {
    console.log(`Funding ${address} with ${amount.toString()}`);
    await fundedAccount.sendTransaction({
      to: address,
      value: amount,
    });
  }
}

void deployFunc();
