pragma solidity 0.8.19;

import "./Nitro-SCW.sol";

contract SCBridgeAccountFactory {
    event AccountCreated(address owner, address intermediary, bytes32 salt);
    event AccountAt(address indexed addr);

    function createAccount(
        address owner,
        address intermediary,
        bytes32 salt
    ) public returns (address) {
        // revert("createAccount reached");
        // emit AccountCreated(owner, intermediary, salt);
        address addr = address(
                new NitroSmartContractWallet{salt: salt}(owner, intermediary)
            );
        emit AccountAt(addr);
        return addr;
    }
}
