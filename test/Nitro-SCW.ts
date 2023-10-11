import {
  loadFixture
} from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'

import hre from 'hardhat'

describe('Nitro-SCW', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployNitroSCW () {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.viem.getWalletClients()

    const nitroSCW = await hre.viem.deployContract('NitroSmartContractWallet')

    const publicClient = await hre.viem.getPublicClient()

    return {
    nitroSCW,
      owner,
      otherAccount,
      publicClient
    }
  }

  describe('Deployment', function () {
    it('Should deploy the nitro SCW', async function () {
      await loadFixture(deployNitroSCW)
    })
  })


describe('validateUserOp', function (){
    it.skip("Should return success if the userOp is signed by the owner and the intermediary", async function () {});
  it.skip("Should only allow challenges if the userOp is signed by the owner", async function () {});
  
});});