pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT

import {IAccount} from "contracts/interfaces/IAccount.sol";
import {UserOperation} from "contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {HTLC, State, hashState, checkSignatures} from "./state.sol";
enum WalletStatus {
    OPEN,
    CHALLENGE_RAISED,
    FINALIZED
}

contract NitroSmartContractWallet is IAccount {
    using ECDSA for bytes32;

    address payable public owner;
    address payable public intermediary;

    bytes32[] activeHTLCs;
    mapping(bytes32 => HTLC) htlcs;

    uint64 highestTurnNum = 0;
    uint htlcCount = 0;
    uint latestExpiry = 0;

    function getStatus() public view returns (WalletStatus) {
        if (latestExpiry == 0) {
            return WalletStatus.OPEN;
        }
        if (block.timestamp > latestExpiry) {
            return WalletStatus.FINALIZED;
        }
        return WalletStatus.CHALLENGE_RAISED;
    }

    function reclaim() public {
        if (latestExpiry < block.timestamp) {
            revert("Not all HTLCs have expired");
        }
        for (uint i = 0; i < activeHTLCs.length; i++) {
            HTLC memory htlc = htlcs[activeHTLCs[i]];
            intermediary.transfer(htlc.amount);
        }

        activeHTLCs = new bytes32[](0);
    }

    function challenge(
        State calldata state,
        bytes calldata ownerSignature,
        bytes calldata intermediarySignature
    ) external {
        checkSignatures(state, ownerSignature, intermediarySignature);

        WalletStatus status = getStatus();
        if (status == WalletStatus.FINALIZED) {
            revert("Wallet already finalized");
        }
        if (
            status == WalletStatus.CHALLENGE_RAISED &&
            state.turnNum <= highestTurnNum
        ) {
            revert("Challenge already exists with a larger TurnNum");
        }
        highestTurnNum = state.turnNum;

        activeHTLCs = new bytes32[](state.htlcs.length);
        for (uint256 i = 0; i < state.htlcs.length; i++) {
            activeHTLCs[i] = state.htlcs[i].hashLock;

            htlcs[state.htlcs[i].hashLock] = state.htlcs[i];

            if (state.htlcs[i].timelock > latestExpiry) {
                latestExpiry = state.htlcs[i].timelock;
            }
        }
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        return _validateSignatures(userOp, userOpHash);
    }

    constructor(address payable o, address payable i) {
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

    // TODO: This is part of the contract so we can use it to hash the state in ts code
    // We should update the ts code to hash the state on it's own
    function getStateHash(State memory state) public pure returns (bytes32) {
        return hashState(state);
    }
}
