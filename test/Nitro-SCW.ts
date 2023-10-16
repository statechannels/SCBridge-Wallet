import hre, { ethers } from 'hardhat'
import { type NitroSmartContractWallet } from '../typechain-types'
import { type BaseWallet } from 'ethers'
import { type UserOperationStruct } from '../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet'
import { expect } from 'chai'
import { getUserOpHash, signUserOp } from './UserOp'
import { deploy4337Infrastructure, type eip4337Infra } from './setup'
import { assert } from 'console'
import { hexConcat, hexValue } from '@ethersproject/bytes'

let infra: eip4337Infra

before(async () => {
  infra = await deploy4337Infrastructure()
})

describe('Nitro-SCW', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployNitroSCW (): Promise<{
    nitroSCW: NitroSmartContractWallet
    owner: BaseWallet
    intermediary: BaseWallet
  }> {
    const deployer = await hre.ethers.getContractFactory(
      'NitroSmartContractWallet'
    )

    const owner = ethers.Wallet.createRandom()
    const intermediary = ethers.Wallet.createRandom()
    const hardhatFundedAccount = (await hre.ethers.getSigners())[0]

    await hardhatFundedAccount.sendTransaction({
      to: owner.address,
      value: ethers.parseEther('1.0')
    })
    await hardhatFundedAccount.sendTransaction({
      to: intermediary.address,
      value: ethers.parseEther('1.0')
    })

    const nitroSCW = await deployer.deploy(owner, intermediary)
    return { nitroSCW, owner, intermediary }
  }

  describe('Deployment', function () {
    it('Should deploy the nitro SCW', async function () {
      await deployNitroSCW()
    })
  })

  describe('validateUserOp', function () {
    it('Should return success if the userOp is signed by the owner and the intermediary', async function () {
      const { nitroSCW, owner, intermediary } = await deployNitroSCW()
      const n = await ethers.provider.getNetwork()
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
        signature: hre.ethers.ZeroHash
      }

      const ownerSig = signUserOp(
        userOp,
        owner,
        ethers.ZeroAddress,
        Number(n.chainId)
      )
      const intermediarySig = signUserOp(
        userOp,
        intermediary,
        ethers.ZeroAddress,
        Number(n.chainId)
      )
      const hash = getUserOpHash(userOp, ethers.ZeroAddress, Number(n.chainId))

      userOp.signature = ethers.concat([ownerSig, intermediarySig])

      // staticCall forces an eth_call, allowing us to easily check the result
      const result = await nitroSCW
        .getFunction('validateUserOp')
        .staticCall(userOp, hash, 0)
      expect(result).to.equal(0)
    })
    it.skip('Should only allow challenges if the userOp is signed by the owner', async function () {})
  })

  describe('initiating an SCBridgeAccount', function () {
    it('Should deploy an SCBridgeAccount at the expected address', async function () {
      // salt is user-supplied to create a specific address unknowable to others in advance
      const salt = ethers.randomBytes(32)
      const SCBridgeWallet = await ethers.getContractFactory(
        'NitroSmartContractWallet'
      )

      const someOwner = hexValue(ethers.Wallet.createRandom().address)
      const someIntermediary = hexValue(ethers.Wallet.createRandom().address)

      // const epAddress = await infra.entryPoint.getAddress()
      const factoryAddress = await infra.SCBridgeFactory.getAddress()

      /*
      todo:
      - what is contract initCode? It is what needs to be 
      - is there existing test of the same functionality that can be referenced?
        - maybe: "sanity: check deployer" in account-abstraction repo
      - do I need the SenderCreator's address?
      */

      // This is the precomputed address of the SCBridgeAccount.
      const expectedAddress = ethers.getCreate2Address(
        // await infra.entryPoint.getAddress(),
        factoryAddress,
        // '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        salt,
        // ethers.keccak256(SCBridgeWallet.bytecode) // this is the runtime bytecode - need initCode?
        ethers.keccak256(SCBridgeWallet.bytecode)
      )
      
      console.table([
        ['owner', someOwner],
        ['intermediary', someIntermediary],
        ['salt', hexValue(salt)],
        ['expectedAddress', expectedAddress]
      ])

      const initCode = hexConcat([
        factoryAddress,
        someOwner,
        someIntermediary,
        salt
      ])
      console.log('initcode', initCode)

      const userOp: UserOperationStruct = {
        initCode,
        sender: expectedAddress,
        nonce: 0,
        callData: hre.ethers.ZeroHash,
        callGasLimit: 10000000,
        verificationGasLimit: 10000000,
        preVerificationGas: 1000000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hre.ethers.ZeroHash,
        signature: hre.ethers.ZeroHash
      }

      // console.log('userOp', userOp)

      // // submit the userOp that initiates the SCBridgeAccount
      await infra.entryPoint.handleOps([userOp], ethers.ZeroAddress)

      const code = await ethers.provider.getCode(expectedAddress)
      console.log(code + '\n\n')
      console.log(SCBridgeWallet.bytecode)
      console.log(code === SCBridgeWallet.bytecode)

      expect(code).to.equal(SCBridgeWallet.bytecode)
    })
  })
})
