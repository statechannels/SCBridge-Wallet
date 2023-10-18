import { ethers } from "hardhat";
import dotenv from "dotenv";
import { EntryPoint__factory } from "../typechain-types";
const deployFunc = async function (): Promise<void> {
  console.log("Starting deployment...");
  const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
  const entrypoint = await entryPointDeployer.deploy();
  const walletDeployer = await ethers.getContractFactory("SCBridgeWallet");
  console.log("EntryPoint deployed to:", await entrypoint.getAddress());
  dotenv.config();
  const aliceAddress = process.env.VITE_ALICE_ADDRESS;
  const bobAddress = process.env.VITE_BOB_ADDRESS;
  const ireneAddress = process.env.VITE_IRENE_ADDRESS;

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

  const initialFunding = ethers.parseEther("10.0");
  const hardhatFundedAccount = (await ethers.getSigners())[0];

  console.log("Funding Alice wallet with", initialFunding.toString());
  await hardhatFundedAccount.sendTransaction({
    to: await aliceWallet.getAddress(),
    value: initialFunding,
  });

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

  console.log("Funding Bob wallet with", initialFunding.toString());
  await hardhatFundedAccount.sendTransaction({
    to: await bobWallet.getAddress(),
    value: initialFunding,
  });

  const entrypointFunding = ethers.parseEther("1");
  console.log(
    `Funding EntryPoint for Alice's wallet with ${entrypointFunding.toString()}`,
  );
  await EntryPoint__factory.connect(
    await entrypoint.getAddress(),
    hardhatFundedAccount,
  ).depositTo(await aliceWallet.getAddress(), { value: entrypointFunding });

  console.log(
    `Funding EntryPoint for Bob's wallet with ${entrypointFunding.toString()}`,
  );
  await EntryPoint__factory.connect(
    await entrypoint.getAddress(),
    hardhatFundedAccount,
  ).depositTo(await bobWallet.getAddress(), { value: entrypointFunding });

  console.log("Funding Irene wallet with", entrypointFunding.toString());
  await hardhatFundedAccount.sendTransaction({
    to: ireneAddress,
    value: entrypointFunding,
  });

  console.log("Deployment complete!");
};

void deployFunc();
