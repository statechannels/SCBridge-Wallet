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
  const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
  const entrypoint = await entryPointDeployer.deploy();
  await entrypoint.waitForDeployment();
  console.log("EntryPoint deployed to:", await entrypoint.getAddress());

  const ireneAddress = process.env.VITE_IRENE_ADDRESS ?? "";

  const aliceAddress = process.env.VITE_ALICE_ADDRESS ?? "";
  const bobAddress = process.env.VITE_BOB_ADDRESS ?? "";
  const charlieAddress = process.env.VITE_CHARLIE_ADDRESS ?? "";
  // ...

  const users = [aliceAddress, bobAddress, charlieAddress];
  const walletDeployer = await ethers.getContractFactory("SCBridgeWallet");
  const userWallets = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const wallet = await walletDeployer.deploy(
      u,
      ireneAddress,
      await entrypoint.getAddress(),
    );
    await wallet.waitForDeployment();
    userWallets.push(wallet);
    console.log(
      `User (${u?.slice(
        0,
        12,
      )}) SCBridgeWallet deployed to: ${await wallet.getAddress()}`,
    );
  }

  const userWalletAddresses = await Promise.all(
    userWallets.map(async (w) => await w.getAddress()),
  );

  const initialFunding = BigInt(process.env.VITE_SCW_DEPOSIT ?? "");
  await fund(
    [await entrypoint.getAddress(), ...userWalletAddresses, ireneAddress],
    BigInt(initialFunding),
    hardhatFundedAccount,
  );

  // Fund the Entrypoint to pay for gas for the SCWs
  await fundEntryPoint(
    userWalletAddresses,
    initialFunding,
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
    console.log(
      `Funding EntryPoint for ${address} with ${ethers.formatEther(
        amount,
      )} ETH`,
    );
    await (
      await EntryPoint__factory.connect(
        entryPointAddress,
        fundedAccount,
      ).depositTo(address, { value: amount })
    ).wait();
  }
}
async function fund(
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
    console.log(`Funding ${address} with ${ethers.formatEther(amount)} ETH`);
    await (
      await fundedAccount.sendTransaction({
        to: address,
        value: amount,
      })
    ).wait();
  }
}

void deployFunc();
