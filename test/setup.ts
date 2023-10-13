import { ethers } from 'hardhat'
import { type EntryPoint, type SCBridgeAccountFactory } from '../typechain-types'

export interface eip4337Infra {
  entryPoint: EntryPoint
  SCBridgeFactory: SCBridgeAccountFactory
}

export async function deploy4337Infrastructure (): Promise<eip4337Infra> {
  const entryPointDeployer = await ethers.getContractFactory('EntryPoint')
  const entryPoint = await entryPointDeployer.deploy()

  const factoryDeployer = await ethers.getContractFactory('SCBridgeAccountFactory')
  const SCBridgeFactory = await factoryDeployer.deploy()

  return { entryPoint, SCBridgeFactory }
}
