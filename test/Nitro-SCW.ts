import hre, { ethers } from "hardhat";
import {
  NitroSmartContractWallet__factory,
  type NitroSmartContractWallet,
} from "../typechain-types";
import { type BaseWallet } from "ethers";

import { expect } from "chai";
import { getUserOpHash, signUserOp } from "../clients/UserOp";
import { hashState, signStateHash } from "./State";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  type UserOperationStruct,
  type StateStruct,
} from "../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet";
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

describe("UserOP submission", function () {
    
    it("should deploy the entrypoint", async function () {
      const entryPointDeployer = await ethers.getContractFactory('EntryPoint')
       await entryPointDeployer.deploy()
})
})
describe("Nitro-SCW", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployNitroSCW(): Promise<{
    nitroSCW: NitroSmartContractWallet;
    owner: BaseWallet;
    intermediary: BaseWallet;
  }> {
    const deployer = await hre.ethers.getContractFactory(
      "NitroSmartContractWallet",
    );

    const owner = ethers.Wallet.createRandom();
    const intermediary = ethers.Wallet.createRandom();
    const hardhatFundedAccount = (await hre.ethers.getSigners())[0];

    await hardhatFundedAccount.sendTransaction({
      to: owner.address,
      value: ethers.parseEther("1.0"),
    });
    await hardhatFundedAccount.sendTransaction({
      to: intermediary.address,
      value: ethers.parseEther("1.0"),
    });

    const nitroSCW = await deployer.deploy(owner, intermediary);
    return {
      nitroSCW: nitroSCW as unknown as NitroSmartContractWallet,
      owner,
      intermediary,
    };
  }

  describe("Deployment", function () {
    it("Should deploy the nitro SCW", async function () {
      await deployNitroSCW();
    });
  });

  describe("Challenge", function () {
    it("Should handle a htlc unlock", async function () {
      const { nitroSCW, owner, intermediary } = await deployNitroSCW();
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
      const { nitroSCW, owner, intermediary } = await deployNitroSCW();
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
      const { nitroSCW, owner, intermediary } = await deployNitroSCW();
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

      const ownerSig = signUserOp(
        userOp,
        owner,
        ethers.ZeroAddress,
        Number(n.chainId),
      );
      const intermediarySig = signUserOp(
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
      const { nitroSCW, owner } = await deployNitroSCW();
      const n = await ethers.provider.getNetwork();

      const userOp: UserOperationStruct = {
        sender: owner.address,
        nonce: 0,
        initCode: hre.ethers.ZeroHash,
        callData:
          NitroSmartContractWallet__factory.createInterface().encodeFunctionData(
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

      const ownerSig = signUserOp(
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
