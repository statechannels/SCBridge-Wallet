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

    uint highestTurnNum = 0;
    uint latestExpiry = 0;

    function getStatus() public view returns (WalletStatus) {
        if (latestExpiry == 0 && highestTurnNum == 0) {
            return WalletStatus.OPEN;
        }
        // If all the htlcs were unlocked afer the challenge was raised then we are finalized
        if (latestExpiry == 0 && highestTurnNum != 0) {
            return WalletStatus.FINALIZED;
        }
        if (block.timestamp > latestExpiry) {
            return WalletStatus.FINALIZED;
        }

        return WalletStatus.CHALLENGE_RAISED;
    }

    function unlockHTLC(bytes32 hashLock, bytes memory preImage) public {
        HTLC memory htlc = htlcs[hashLock];

        require(htlc.timelock > block.timestamp, "HTLC already expired");
        require(htlc.hashLock == keccak256(preImage), "Invalid preImage");

        removeActiveHTLC(hashLock);

        if (htlc.to == address(this)) {
            // If the HTLC is to the wallet itself then we don't bother transferring the funds
            // since they are already in the wallet
            return;
        }
        htlc.to.transfer(htlc.amount);
    }

    function removeActiveHTLC(bytes32 hashLock) private {
        for (uint i = 0; i < activeHTLCs.length; i++) {
            if (activeHTLCs[i] == hashLock) {
                // Shift elements over
                for (uint j = i; j < activeHTLCs.length - 1; j++) {
                    activeHTLCs[j] = activeHTLCs[j + 1];
                }
                // remove the duplicate at the end
                activeHTLCs.pop();
                break;
            }
        }
        updateLatestExpiry();
    }

    function updateLatestExpiry() private {
        if (activeHTLCs.length == 0) {
            latestExpiry = 0;
            return;
        }
        for (uint i = 0; i < activeHTLCs.length; i++) {
            HTLC memory htlc = htlcs[activeHTLCs[i]];
            if (htlc.timelock > latestExpiry) {
                latestExpiry = htlc.timelock;
            }
        }
    }

    function reclaim() public {
        require(block.timestamp > latestExpiry, "HTLCs not expired yet");
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

        require(status != WalletStatus.FINALIZED, "Wallet already finalized");
        require(
            status != WalletStatus.CHALLENGE_RAISED ||
                state.turnNum > highestTurnNum,
            "Challenge already exists with a larger TurnNum"
        );

        highestTurnNum = state.turnNum;

        activeHTLCs = new bytes32[](state.htlcs.length);
        for (uint256 i = 0; i < state.htlcs.length; i++) {
            activeHTLCs[i] = state.htlcs[i].hashLock;
            htlcs[state.htlcs[i].hashLock] = state.htlcs[i];
        }
        updateLatestExpiry();
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        require(userOp.signature.length == 2 * 65, "Invalid signature length");
        require(userOp.signature.length != 0x0, "Empty signature");

        bytes memory ownerSig = userOp.signature[0:65];
        bytes memory intermediarySig = userOp.signature[65:130];

        // The owner of the wallet must always approve of any user operation to execute on it's behalf
        require(!isZero(ownerSig), "Must be signed by owner");

        // If the wallet is finalized then the owner can do whatever they want with the remaining funds
        if (getStatus() == WalletStatus.FINALIZED) {
            return validateSignature(userOpHash, ownerSig, owner);
        }
        // If the user op is doubly-signed then the wallet is allowed to do whatever it wants since everyone has approved it
        if (!isZero(ownerSig) && !isZero(intermediarySig)) {
            return
                validateSignature(userOpHash, ownerSig, owner) |
                validateSignature(userOpHash, intermediarySig, intermediary);
        }

        // Otherwise the wallet is open or has a challenge raised and the owner is only allowed to do certain things
        bytes4 functionSelector = bytes4(userOp.callData[0:4]);
        require(
            functionSelector == this.challenge.selector ||
                functionSelector == this.reclaim.selector ||
                functionSelector == this.unlockHTLC.selector,
            "Invalid function selector"
        );
        return validateSignature(userOpHash, ownerSig, owner);
    }

    constructor(address payable o, address payable i) {
        owner = o;
        intermediary = i;
    }

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    function validateSignature(
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

    function isZero(bytes memory b) internal pure returns (bool) {
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] != 0) {
                return false;
            }
        }
        return true;
    }

    // TODO: This is part of the contract so we can use it to hash the state in ts code
    // We should update the ts code to hash the state on it's own
    function getStateHash(State memory state) public pure returns (bytes32) {
        return hashState(state);
    }
}
