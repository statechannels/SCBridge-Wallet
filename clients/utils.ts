import { ethers } from "ethers";

const accountABI = ["function execute(address to, uint256 value, bytes data)"];
export const IAccount = new ethers.Interface(accountABI);
