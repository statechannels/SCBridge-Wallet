// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Nitro-SCW.sol";

contract SCBridgeAccountFactory {
    function createAccount(
        address owner,
        address payable intermediary,
        bytes32 salt
    ) public returns (address) {
        return
            address(
                new NitroSmartContractWallet{salt: salt}(owner, intermediary)
            );
    }
}
