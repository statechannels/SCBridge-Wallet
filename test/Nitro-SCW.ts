import hre from 'hardhat'
import { type NitroSmartContractWallet } from '../typechain-types'

import { type UserOperationStruct } from '../typechain-types/contracts/Nitro-SCW.sol/NitroSmartContractWallet'

describe('Nitro-SCW', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployNitroSCW (): Promise<NitroSmartContractWallet> {
    const deployer = await hre.ethers.getContractFactory('NitroSmartContractWallet')
    return deployer.deploy()
  }

  describe('Deployment', function () {
    it('Should deploy the nitro SCW', async function () {
      await deployNitroSCW()
    })
  })

  describe('validateUserOp', function () {
    it('Should return success if the userOp is signed by the owner and the intermediary', async function () {
      const nitroSCW = await deployNitroSCW()

      const userOp: UserOperationStruct = {
        sender: hre.ethers.ZeroAddress,
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

      const result = await nitroSCW.validateUserOp(userOp, hre.ethers.ZeroHash, 0)
      await result.wait()
    })
    it.skip('Should only allow challenges if the userOp is signed by the owner', async function () {})
  })
})
