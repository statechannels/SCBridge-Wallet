// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./SCBridgeWallet.sol";

contract SCBridgeAccountFactory {
  function createAccount(
    address owner,
    address payable intermediary,
    address entrypoint,
    bytes32 salt
  ) public returns (address) {
    return
      address(new SCBridgeWallet{salt: salt}(owner, intermediary, entrypoint));
  }
}
