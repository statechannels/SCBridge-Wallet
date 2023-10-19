import hre, { ethers } from "hardhat";
import {
  type SCBridgeWallet,
  type EntryPoint,
  SCBridgeWallet__factory,
} from "../typechain-types";
import { getBytes, type BaseWallet } from "ethers";

import { expect } from "chai";
import { getUserOpHash, signUserOp } from "../clients/UserOp";
import { hashState, signStateHash } from "../clients/State";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  type UserOperationStruct,
  type StateStruct,
} from "../typechain-types/contracts/SCBridgeWallet";
import { Participant } from "../clients/StateChannelWallet";
import { type Invoice, MessageType } from "../clients/Messages";
import { convertInvoice } from "../clients/Accounting";
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

describe("characters", function () {
  it("have correct keys", () => {
    const characters: Array<{ key: string; address: string; name: string }> = [
      {
        name: "Alice",
        address: "0xAAA6628Ec44A8a742987EF3A114dDFE2D4F7aDCE",
        key: "0x2d999770f7b5d49b694080f987b82bbc9fc9ac2b4dcc10b0f8aba7d700f69c6d",
      },
      {
        name: "Bob",
        address: "0xBBB676f9cFF8D242e9eaC39D063848807d3D1D94",
        key: "0x0279651921cd800ac560c21ceea27aab0107b67daf436cdd25ce84cad30159b4",
      },
      {
        name: "Charlie",
        key: "0x827d8121978e93d2e9b01be98fd8bdb08eaa0145184442bb6ab0be17f6ab4248",
        address: "0xccc182e9C61ABed84B4df353C8a066EB7a2FeE6f",
      },
      {
        name: "Debbie",
        address: "0xddd63cb783fF61D683e4BED42a03Aa6b5AF7De2B",
        key: "0x07dbfb9cdfa0dcddcc82f86da46ca63db210eaddeab7410d5dda9a18bbf3eb5f",
      },

      {
        name: "Eve",
        address: "0xeeef433cD1EF1714d176202D0Aa7680F20aa7F89",
        key: "0x22215c87ad66bed27b715e39c3fd105a6616eb139a4106773b1b67233b7796d4",
      },

      {
        name: "Fred",
        address: "0xfff1b9434a6B6402508911028545Aa9CE080ab12",
        key: "0x1234f96c85acb25dff1f20e03ba287a008c99a02541ba5a9ae8b4392dd12d4ff",
      },
      {
        name: "Irene",
        address: "0x111A00868581f73AB42FEEF67D235Ca09ca1E8db",
        key: "0xfebb3b74b0b52d0976f6571d555f4ac8b91c308dfa25c7b58d1e6a7c3f50c781",
      },
    ];

    characters.forEach((c) => {
      // const signingKey = new ethers.SigningKey(getBytes(c.key));
      const foundAddress = new ethers.Wallet(c.key).address;
      expect(foundAddress).to.equal(c.address);
    });
  });
});

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
    const hardhatFundedAccount = (await hre.ethers.getSigners())[0];

    await hardhatFundedAccount.sendTransaction({
      to: owner.address,
      value: ethers.parseEther("1.0"),
    });
    await hardhatFundedAccount.sendTransaction({
      to: intermediary.address,
      value: ethers.parseEther("1.0"),
    });

    const entryPointDeployer = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await entryPointDeployer.deploy();
    const entrypointAddress = await entrypoint.getAddress();

    const nitroSCW = await deployer.deploy(owner, intermediary, entrypoint);

    await hardhatFundedAccount.sendTransaction({
      to: await nitroSCW.getAddress(),
      value: ethers.parseEther("1.0"),
    });

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

    // Generate a random payee address that we can use for the transfer.

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
    it("allows specific functions to be called when signed by one actor", async function () {
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

describe("invoice conversions", () => {
  it("recovers original invoice when converting back and forth", () => {
    const invoice: Invoice = {
      amount: 50n,
      chain: 31337n,
      hashLock: "hello",
      type: MessageType.Invoice,
    };
    const converted = convertInvoice(invoice, 31338n);
    const recovered = convertInvoice(converted, 31337n);

    expect(converted.amount).to.not.equal(invoice.amount);
    expect(recovered.amount).to.equal(invoice.amount);
  });
});

describe("off chain signatures", () => {
  it("works", () => {
    const owner = ethers.Wallet.createRandom();
    const intermediary = ethers.Wallet.createRandom();

    const state: StateStruct = {
      owner: owner.address,
      intermediary: intermediary.address,
      turnNum: 1,
      intermediaryBalance: 0,
      htlcs: [
        {
          amount: 0,
          to: Participant.Intermediary,
          hashLock: ethers.ZeroHash,
          timelock: 47,
        },
      ],
    };

    const stateHash = hashState(state);

    const [ownerSig, intermediarySig] = signStateHash(
      stateHash,
      owner,
      intermediary,
    );

    const recoveredSigner1 = ethers.recoverAddress(
      ethers.hashMessage(getBytes(stateHash)),
      intermediarySig,
    );
    expect(recoveredSigner1).to.equal(intermediary.address);

    const recoveredSigner2 = ethers.recoverAddress(
      ethers.hashMessage(getBytes(stateHash)),
      ownerSig,
    );
    expect(recoveredSigner2).to.equal(owner.address);
  });
});
