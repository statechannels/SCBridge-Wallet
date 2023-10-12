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
        return _validateSignatures(userOp, userOpHash);
    }

    constructor(address o, address i) {
        owner = o;
        intermediary = i;
    }

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    function _validateSignature(
        bytes32 userOpHash,
        bytes memory signature,
        address expectedSigner
    ) private view returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (expectedSigner != hash.recover(signature)) {
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }

    function _isZero(bytes memory b) internal pure returns (bool) {
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] != 0) {
                return false;
            }
        }
        return true;
    }

    function _validateSignatures(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual returns (uint256 validationData) {
        if (userOp.signature.length != 2 * 65) {
            revert("Invalid signature length");
        }
        if (userOp.signature.length == 0x0) {
            revert("Empty signature");
        }

        bytes memory ownerSig = userOp.signature[0:65];
        bytes memory intermediarySig = userOp.signature[65:130];

        // We have a signature from BOTH participants
        if (!_isZero(ownerSig) && !_isZero(intermediarySig)) {
            return
                _validateSignature(userOpHash, ownerSig, owner) |
                _validateSignature(userOpHash, intermediarySig, intermediary);
        } else if (!_isZero(ownerSig)) {
            revert(
                "TODO: Only owner signed. Should only allow specific functionality`"
            );
        } else if (!_isZero(intermediarySig)) {
            revert(
                "TODO: Only intermediary signed. Should only allow specific functionality`"
            );
        }

        return SIG_VALIDATION_FAILED;
    }
}
