import { type HardhatRuntimeEnvironment } from "hardhat/types";
import { type DeployFunction } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import dotenv from "dotenv";
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  dotenv.config();

  const aliceAddress = process.env.VITE_ALICE_ADDRESS;
  const bobAddress = process.env.VITE_BOB_ADDRESS;
  const ireneAddress = process.env.VITE_IRENE_ADDRESS;

  const { deployments } = hre;
  const { deterministic } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Starting deployment...");
  const entrypoint = await deterministic("EntryPoint", {
    from: deployer,
    args: [],

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log("EntryPoint deployed to:", entrypoint.address);

  const aliceWallet = await deterministic("SCBridgeWallet", {
    from: deployer,
    args: [aliceAddress, ireneAddress, entrypoint.address],

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log(
    `Alice (${aliceAddress?.slice(0, 12)}) SCBridgeWallet deployed to: ${
      aliceWallet.address
    }`,
  );

  const bobWallet = await deterministic("SCBridgeWallet", {
    from: deployer,
    args: [bobAddress, ireneAddress, entrypoint.address],

    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log(
    `Bob (${bobAddress?.slice(0, 12)}) SCBridgeWallet deployed to: ${
      bobWallet.address
    }`,
  );

  console.log("Deployment complete!");
};
export default func;
