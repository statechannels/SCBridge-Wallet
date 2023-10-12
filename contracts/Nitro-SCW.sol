pragma solidity 0.8.17;

// SPDX-License-Identifier: MIT
import {NitroAdjudicator} from "@statechannels/nitro-protocol/contracts/NitroAdjudicator.sol";
import {IAccount} from "contracts/interfaces/IAccount.sol";
import {UserOperation} from "contracts/interfaces/UserOperation.sol";

contract NitroSmartContractWallet is NitroAdjudicator, IAccount {
    address public owner;

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        return 0;
    }

    constructor(address o) {
        owner = o;
    }
}
