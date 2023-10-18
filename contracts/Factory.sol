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

  function computeAddress(
    address owner,
    address payable intermediary,
    address entrypoint,
    bytes32 salt
  ) public view returns (address) {
    return
      address(
        uint160(
          uint(
            keccak256(
              abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(
                  abi.encodePacked(
                    type(SCBridgeWallet).creationCode,
                    abi.encode(owner),
                    abi.encode(intermediary),
                    abi.encode(entrypoint)
                  )
                )
              )
            )
          )
        )
      );
  }
}
