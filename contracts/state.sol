pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
struct State {
    address payable owner;
    address payable intermediary;
    uint64 turnNum;
    HTLC[] htlcs;
}

struct HTLC {
    address payable sender;
    address payable receiver;
    uint amount;
    bytes32 hashLock;
    uint timelock;
}

function hashState(State memory state) pure returns (bytes32) {
    return keccak256(abi.encode(state));
}

using ECDSA for bytes32;

function checkSignatures(
    State calldata state,
    bytes calldata ownerSignature,
    bytes calldata intermediarySignature
) pure {
    bytes32 stateHash = hashState(state);
    if (
        state.owner !=
        stateHash.toEthSignedMessageHash().recover(ownerSignature)
    ) {
        revert("Invalid owner signature");
    }
    if (
        state.intermediary !=
        stateHash.toEthSignedMessageHash().recover(intermediarySignature)
    ) {
        revert("Invalid intermediary signature");
    }
}
