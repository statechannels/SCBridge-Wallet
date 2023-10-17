import { type HardhatRuntimeEnvironment } from "hardhat/types";
import { type DeployFunction } from "hardhat-deploy/types";
import { ethers, getNamedAccounts } from "hardhat";
import dotenv from "dotenv";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("Starting deployment...");
  dotenv.config();
  const aliceAddress = process.env.VITE_ALICE_ADDRESS;
  const bobAddress = process.env.VITE_BOB_ADDRESS;
  const ireneAddress = process.env.VITE_IRENE_ADDRESS;
  const salt = ethers.encodeBytes32String(
    process.env.VITE_DEPLOY_SALT_STRING ?? "",
  );
  console.log(
    `Using salt ${salt} based on salt string '${
      process.env.VITE_DEPLOY_SALT_STRING ?? ""
    }'`,
  );
  const { deployments } = hre;
  const { deterministic } = deployments;
  const { deployer } = await getNamedAccounts();
  const hardhatFundedAccount = (await hre.ethers.getSigners())[0];

  const entrypoint = await deterministic("EntryPoint", {
    from: deployer,
    args: [],
    salt,

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log("EntryPoint deployed to:", entrypoint.address);

  const aliceWallet = await deterministic("SCBridgeWallet", {
    from: deployer,
    args: [aliceAddress, ireneAddress, entrypoint.address],
    salt,

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log(
    `Alice (${aliceAddress?.slice(0, 12)}) SCBridgeWallet deployed to: ${
      aliceWallet.address
    }`,
  );

  const initialFunding = ethers.parseEther("10.0");

  console.log("Funding Alice wallet with", initialFunding.toString());
  await hardhatFundedAccount.sendTransaction({
    to: aliceWallet.address,
    value: initialFunding,
  });

  const bobWallet = await deterministic("SCBridgeWallet", {
    from: deployer,
    args: [bobAddress, ireneAddress, entrypoint.address],
    salt,

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log(
    `Bob (${bobAddress?.slice(0, 12)}) SCBridgeWallet deployed to: ${
      bobWallet.address
    }`,
  );

  console.log("Funding Bob wallet with", initialFunding.toString());
  await hardhatFundedAccount.sendTransaction({
    to: bobWallet.address,
    value: initialFunding,
  });

  console.log("Deployment complete!");
};
export default func;
