pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT

import {IAccount} from "contracts/interfaces/IAccount.sol";
import {UserOperation} from "contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {HTLC, State, hashState, checkSignatures, Participant} from "./state.sol";
enum WalletStatus {
    OPEN,
    CHALLENGE_RAISED,
    FINALIZED
}

uint constant CHALLENGE_WAIT = 1 days;

contract NitroSmartContractWallet is IAccount {
    using ECDSA for bytes32;

    address public owner;
    address payable public intermediary;

    bytes32[] activeHTLCs;
    mapping(bytes32 => HTLC) htlcs;

    uint highestTurnNum = 0;
    uint challengeExpiry = 0;
    uint public intermediaryBalance = 0;

    function getStatus() public view returns (WalletStatus) {
        if (challengeExpiry == 0) {
            return WalletStatus.OPEN;
        }

        if (block.timestamp > challengeExpiry) {
            return WalletStatus.FINALIZED;
        }

        return WalletStatus.CHALLENGE_RAISED;
    }

    // Define the fallback function so that the wallet can receive funds
    receive() external payable {}

    function unlockHTLC(bytes32 hashLock, bytes memory preImage) public {
        HTLC memory htlc = htlcs[hashLock];

        require(htlc.timelock > block.timestamp, "HTLC already expired");
        require(htlc.hashLock == keccak256(preImage), "Invalid preImage");

        removeActiveHTLC(hashLock);

        if (htlc.to == Participant.INTERMEDIARY) {
            intermediaryBalance += htlc.amount;
        }
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
        delete htlcs[hashLock];
    }

    function reclaim() public {
        require(getStatus() == WalletStatus.FINALIZED, "Wallet not finalized");

        // Release any expired funds back to the sender
        for (uint i = 0; i < activeHTLCs.length; i++) {
            HTLC memory htlc = htlcs[activeHTLCs[i]];
            if (htlc.to == Participant.OWNER) {
                intermediary.transfer(htlc.amount);
            }

            // Any funds that are left over are defacto controlled by the owner
        }

        intermediary.transfer(intermediaryBalance);

        intermediaryBalance = 0;
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
        intermediaryBalance = state.intermediaryBalance;

        uint largestTimeLock = 0;
        activeHTLCs = new bytes32[](state.htlcs.length);
        for (uint256 i = 0; i < state.htlcs.length; i++) {
            activeHTLCs[i] = state.htlcs[i].hashLock;
            htlcs[state.htlcs[i].hashLock] = state.htlcs[i];
            if (state.htlcs[i].timelock > largestTimeLock) {
                largestTimeLock = state.htlcs[i].timelock;
            }
        }

        challengeExpiry = largestTimeLock + CHALLENGE_WAIT;
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        //directly from an EOA owner, or through the account itself
        require(
            msg.sender == owner || msg.sender == address(this),
            "only owner"
        );

        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 // missingAccountFunds
    ) external view returns (uint256 validationData) {
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

    constructor(address o, address payable i) {
        owner = o;
        intermediary = i;
    }

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    function validateSignature(
        bytes32 userOpHash,
        bytes memory signature,
        address expectedSigner
    ) private pure returns (uint256 validationData) {
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
}
