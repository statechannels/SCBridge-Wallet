pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT

import {IAccount} from "contracts/interfaces/IAccount.sol";
import {UserOperation} from "contracts/interfaces/UserOperation.sol";

contract NitroSmartContractWallet is IAccount {
    address public owner;
    address public intermediary;

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
            if (owner != recoverSigner(userOpHash, userOp.signature)) {
                return SIG_VALIDATION_FAILED;
            }
            return 0;
        } else {
            revert("Invalid signature length");
        }
    }

    // TODO: These are copied from https://solidity-by-example.org/signature/
    // If we upgrade to 0.8.19 of solidity we can use the built in recover
    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }
}
