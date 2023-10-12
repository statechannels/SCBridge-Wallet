pragma solidity 0.8.19;

// SPDX-License-Identifier: MIT

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
