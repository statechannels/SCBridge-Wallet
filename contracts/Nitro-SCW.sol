pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT

import {IAccount} from "contracts/interfaces/IAccount.sol";
import {UserOperation} from "contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract NitroSmartContractWallet is IAccount {
    address public owner;
    address public intermediary;
    using ECDSA for bytes32;

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        return _validateSignature(userOp, userOpHash);
    }

    constructor(address o, address i) {
        owner = o;
        intermediary = i;
    }

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    // This validates the UserOp is signed by the owner
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual returns (uint256 validationData) {
        if (userOp.signature.length == 2 * 65) {
            revert("TODO: Handle UserOp signed by owner and intermediary");
        } else if (userOp.signature.length == 65) {
            // TODO: Verify the userOp is for a challenge specifically
            bytes32 hash = userOpHash.toEthSignedMessageHash();
            if (owner != hash.recover(userOp.signature))
                return SIG_VALIDATION_FAILED;
            return 0;
        } else {
            revert("Invalid signature length");
        }
    }

