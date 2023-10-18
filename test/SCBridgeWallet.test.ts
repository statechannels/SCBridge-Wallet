import hre, { ethers } from "hardhat";
import {
  type SCBridgeWallet,
  type EntryPoint,
  SCBridgeWallet__factory,
  type SCBridgeAccountFactory,
} from "../typechain-types";
import { type BaseWallet } from "ethers";

import { expect } from "chai";
import { getUserOpHash, signUserOp } from "../clients/UserOp";
import { hashState, signStateHash } from "../clients/State";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  type UserOperationStruct,
  type StateStruct,
} from "../typechain-types/contracts/SCBridgeWallet";
import { Participant } from "../clients/StateChannelWallet";
const ONE_DAY = 86400;
const TIMELOCK_DELAY = 1000;
async function getBlockTimestamp(): Promise<number> {
  const blockNum = await hre.ethers.provider.getBlockNumber();
  const block = await hre.ethers.provider.getBlock(blockNum);
  if (block == null) {
    throw new Error(`Block ${blockNum} not found`);
  }
  return block.timestamp;
}

async function fundAddresses(
  accounts: string[],
  amount: bigint,
): Promise<void> {
  const hardhatFundedAccount = (await hre.ethers.getSigners())[0];

  for (const account of accounts) {
    await hardhatFundedAccount.sendTransaction({
      to: account,
      value: amount,
    });
  }
}
describe("SCBridgeWallet", function () {
  async function deploySCBridgeWallet(): Promise<{
    nitroSCW: SCBridgeWallet;
    owner: BaseWallet;
    intermediary: BaseWallet;
    entrypointAddress: string;
    entrypoint: EntryPoint;
  }> {
    const deployer = await hre.ethers.getContractFactory("SCBridgeWallet");

    const owner = ethers.Wallet.createRandom();

    const intermediary = ethers.Wallet.createRandom();

    const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await entryPointDeployer.deploy();
    const entrypointAddress = await entrypoint.getAddress();

    const nitroSCW = await deployer.deploy(owner, intermediary, entrypoint);
    await fundAddresses(
      [owner.address, intermediary.address, await nitroSCW.getAddress()],
      ethers.parseEther("1.0"),
    );

    // The entrypoint contract requires a deposit from the submitter if not using a paymaster
    await entrypoint.depositTo(await nitroSCW.getAddress(), {
      value: ethers.parseEther("1.0"),
    });

    return {
      nitroSCW: nitroSCW as unknown as SCBridgeWallet,
      owner,
      intermediary,
      entrypointAddress,
      entrypoint: entrypoint as unknown as EntryPoint,
    };
  }

  it("should support executing a simple L1 transfer through the entrypoint using a counterfactual deployment", async function () {
    const owner = ethers.Wallet.createRandom();
    const intermediary = ethers.Wallet.createRandom();

    const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await entryPointDeployer.deploy();
    const entrypointAddress = await entrypoint.getAddress();

    const salt = ethers.encodeBytes32String("Super secret salt");

    const factoryDeployer = await hre.ethers.getContractFactory(
      "SCBridgeAccountFactory",
    );
    const scwFactory =
      (await factoryDeployer.deploy()) as unknown as SCBridgeAccountFactory;

    // Call the factory function to compute the address of the SCW
    // This can be done locally but it's easier to call into a view function
    const precomputedSCWAddress = await scwFactory.computeAddress(
      owner.address,
      intermediary.address,
      entrypointAddress,
      salt,
    );

    await fundAddresses(
      [owner.address, intermediary.address, precomputedSCWAddress],
      ethers.parseEther("1.0"),
    );

    // The entrypoint contract requires a deposit from the submitter if not using a paymaster
    await entrypoint.depositTo(precomputedSCWAddress, {
      value: ethers.parseEther("1.0"),
    });
    const n = await ethers.provider.getNetwork();

    // Generate a random payee address that we can use for the transfer.
    const payee = ethers.Wallet.createRandom();

    // Encode calldata that calls the execute function to perform a simple transfer of ether to the payee.
    const callData =
      SCBridgeWallet__factory.createInterface().encodeFunctionData("execute", [
        payee.address,
        ethers.parseEther("0.5"),
        "0x",
      ]);

    const initCode = ethers.concat([
      await scwFactory.getAddress(),
      scwFactory.interface.encodeFunctionData("createAccount", [
        owner.address,
        intermediary.address,
        entrypointAddress,
        salt,
      ]),
    ]);

    const userOp: UserOperationStruct = {
      sender: precomputedSCWAddress,
      nonce: 0,
      initCode,
      callData,
      callGasLimit: 40_000,
      verificationGasLimit: 3000000,
      preVerificationGas: 21000,
      maxFeePerGas: 40_000,
      maxPriorityFeePerGas: 40_000,
      paymasterAndData: hre.ethers.ZeroHash,
      signature: hre.ethers.ZeroHash,
    };

    const { signature: ownerSig } = signUserOp(
      userOp,
      owner,
      await entrypoint.getAddress(),
      Number(n.chainId),
    );
    const { signature: intermediarySig } = signUserOp(
      userOp,
      intermediary,
      await entrypoint.getAddress(),
      Number(n.chainId),
    );

    userOp.signature = ethers.concat([ownerSig, intermediarySig]);

    // Submit the userOp to the entrypoint and wait for it to be mined.
    const res = await entrypoint.handleOps([userOp], owner.address);
    await res.wait();

    // Check that the transfer executed..
    const balance = await hre.ethers.provider.getBalance(payee.address);
    expect(balance).to.equal(ethers.parseEther("0.5"));
  });
  it("should support executing a simple L1 transfer through the entrypoint", async function () {
    const { owner, intermediary, nitroSCW, entrypoint } =
      await deploySCBridgeWallet();

    const n = await ethers.provider.getNetwork();

    const deployer = await hre.ethers.getContractFactory("SCBridgeWallet");

    const payeeSCW = await deployer.deploy(
      ethers.Wallet.createRandom(),
      intermediary,
      entrypoint,
    );

    // Encode calldata that calls the execute function to perform a simple transfer of ether to the payee.
    const callData = nitroSCW.interface.encodeFunctionData("execute", [
      await payeeSCW.getAddress(),
      ethers.parseEther("0.5"),
      "0x",
    ]);

    const userOp: UserOperationStruct = {
      sender: await nitroSCW.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData,
      callGasLimit: 40_000,
      verificationGasLimit: 150000,
      preVerificationGas: 21000,
      maxFeePerGas: 40_000,
      maxPriorityFeePerGas: 40_000,
      paymasterAndData: hre.ethers.ZeroHash,
      signature: hre.ethers.ZeroHash,
    };

    const { signature: ownerSig } = signUserOp(
      userOp,
      owner,
      await entrypoint.getAddress(),
      Number(n.chainId),
    );
    const { signature: intermediarySig, hash } = signUserOp(
      userOp,
      intermediary,
      await entrypoint.getAddress(),
      Number(n.chainId),
    );

    userOp.signature = ethers.concat([ownerSig, intermediarySig]);

    // sanity check that the userOp is valid
    const result = await nitroSCW
      .getFunction("validateUserOp")
      .staticCall(userOp, hash, 0);
    expect(result).to.equal(0);

    // Submit the userOp to the entrypoint and wait for it to be mined.
    const res = await entrypoint.handleOps([userOp], owner.address);
    await res.wait();

    // Check that the transfer executed..
    const balance = await hre.ethers.provider.getBalance(
      await payeeSCW.getAddress(),
    );
    expect(balance).to.equal(ethers.parseEther("0.5"));
  });

  describe("Deployment", function () {
    it("Should deploy the SCBridgeWallet", async function () {
      await deploySCBridgeWallet();
    });
  });

  describe("Challenge", function () {
    it("Should handle a htlc unlock", async function () {
      const { nitroSCW, owner, intermediary } = await deploySCBridgeWallet();
      const secret = ethers.toUtf8Bytes(
        "Super secret preimage for the hashlock",
      );
      const hash = ethers.keccak256(secret);
      const state: StateStruct = {
        owner: owner.address,
        intermediary: intermediary.address,
        intermediaryBalance: 0,
        turnNum: 1,
        htlcs: [
          {
            amount: 0,
            to: Participant.Intermediary,
            hashLock: hash,
            timelock: (await getBlockTimestamp()) + TIMELOCK_DELAY,
          },
        ],
      };

      const stateHash = hashState(state);

      const [ownerSig, intermediarySig] = signStateHash(
        stateHash,
        owner,
        intermediary,
      );
      await nitroSCW.challenge(state, ownerSig, intermediarySig);

      // Check that the the status is now challenged
      expect(await nitroSCW.getStatus()).to.equal(1);

      await nitroSCW.unlockHTLC(hash, secret);

      // Even though all the HTLCs are cleared we still need to wait for the min challenge duration
      expect(await nitroSCW.getStatus()).to.equal(1);

      await time.increase(ONE_DAY + TIMELOCK_DELAY);

      expect(await nitroSCW.getStatus()).to.equal(2);
    });
    it("Should handle a challenge and reclaim", async function () {
      const { nitroSCW, owner, intermediary } = await deploySCBridgeWallet();
      const secret = ethers.toUtf8Bytes(
        "Super secret preimage for the hashlock",
      );
      const hash = ethers.keccak256(secret);
      const state: StateStruct = {
        owner: owner.address,
        intermediary: intermediary.address,
        turnNum: 1,
        intermediaryBalance: 0,
        htlcs: [
          {
            amount: 0,
            to: Participant.Intermediary,
            hashLock: hash,
            timelock: (await getBlockTimestamp()) + 1000,
          },
        ],
      };

      const stateHash = hashState(state);

      const [ownerSig, intermediarySig] = signStateHash(
        stateHash,
        owner,
        intermediary,
      );
      await nitroSCW.challenge(state, ownerSig, intermediarySig);

      // Check that the the status is now challenged
      expect(await nitroSCW.getStatus()).to.equal(1);

      // Advance the block time
      await time.increase(ONE_DAY + TIMELOCK_DELAY);

      await nitroSCW.reclaim();

      // Check that the the status is now finalized
      expect(await nitroSCW.getStatus()).to.equal(2);
    });
  });

  describe("validateUserOp", function () {
    it("Should return success if the userOp is signed by the owner and the intermediary", async function () {
      const { nitroSCW, owner, intermediary } = await deploySCBridgeWallet();
      const n = await ethers.provider.getNetwork();
      const userOp: UserOperationStruct = {
        sender: owner.address,
        nonce: 0,
        initCode: hre.ethers.ZeroHash,
        callData: hre.ethers.ZeroHash,
        callGasLimit: 0,
        verificationGasLimit: 0,
        preVerificationGas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        paymasterAndData: hre.ethers.ZeroHash,
        signature: hre.ethers.ZeroHash,
      };

      const { signature: ownerSig } = signUserOp(
        userOp,
        owner,
        ethers.ZeroAddress,
        Number(n.chainId),
      );
      const { signature: intermediarySig } = signUserOp(
        userOp,
        intermediary,
        ethers.ZeroAddress,
        Number(n.chainId),
      );
      const hash = getUserOpHash(userOp, ethers.ZeroAddress, Number(n.chainId));

      userOp.signature = ethers.concat([ownerSig, intermediarySig]);

      // staticCall forces an eth_call, allowing us to easily check the result
      const result = await nitroSCW
        .getFunction("validateUserOp")
        .staticCall(userOp, hash, 0);
      expect(result).to.equal(0);
    });
    it("only allows specific functions to be called when signed by one actor", async function () {
      const { nitroSCW, owner } = await deploySCBridgeWallet();
      const n = await ethers.provider.getNetwork();

      const userOp: UserOperationStruct = {
        sender: owner.address,
        nonce: 0,
        initCode: hre.ethers.ZeroHash,
        callData:
          SCBridgeWallet__factory.createInterface().encodeFunctionData(
            "reclaim",
          ),
        callGasLimit: 0,
        verificationGasLimit: 0,
        preVerificationGas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        paymasterAndData: hre.ethers.ZeroHash,
        signature: hre.ethers.ZeroHash,
      };

      const { signature: ownerSig } = signUserOp(
        userOp,
        owner,
        ethers.ZeroAddress,
        Number(n.chainId),
      );

      const hash = getUserOpHash(userOp, ethers.ZeroAddress, Number(n.chainId));
      userOp.signature = ethers.zeroPadBytes(ownerSig, 130);

      // staticCall forces an eth_call, allowing us to easily check the result
      const result = await nitroSCW
        .getFunction("validateUserOp")
        .staticCall(userOp, hash, 0);
      expect(result).to.equal(0);
    });
  });
});
