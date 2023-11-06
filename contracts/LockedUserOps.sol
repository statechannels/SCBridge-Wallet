pragma solidity 0.8.19;

import {UserOperation} from "contracts/interfaces/UserOperation.sol";
import {IEntryPoint} from "contracts/interfaces/IEntryPoint.sol";

struct LockedOp {
  UserOperation userOp;
  uint256 expiry;
  // uint256 value; // todo
}

contract LockedUserOps {
  mapping(bytes32 => LockedOp) public lockedUserOps;
  IEntryPoint public entryPoint;

  constructor(IEntryPoint _entryPoint) {
    entryPoint = _entryPoint;
  }

  /**
   * @dev Register a UserOperation that can be released by the user.
   * @param hashlock - Hashlock of the UserOperation
   * @param userOp - UserOperation to be registered
   */
  function registerUserOp(
    bytes32 hashlock,
    LockedOp memory userOp
  ) public payable {
    require(userOp.expiry > block.timestamp, "UserOp already expired");
    require(lockedUserOps[hashlock].expiry == 0, "UserOp already registered");

    lockedUserOps[hashlock] = userOp;
    // todo: account for transferred `value`
  }

  function releaseSHAuserOp(bytes calldata preimage) public {
    // check
    bytes32 hashlock = sha256(preimage);
    LockedOp memory lockedOp = lockedUserOps[hashlock];
    require(lockedOp.expiry > 0, "UserOp not found");

    // effect
    delete lockedUserOps[hashlock];

    // interaction
    // todo: pass in required `value` / `gas` parameters
    executeUserOp(lockedOp.userOp);
  }

  function releaseUserOp(bytes calldata preimage) public {
    // check
    bytes32 hashlock = keccak256(preimage);
    LockedOp memory lockedOp = lockedUserOps[hashlock];
    require(lockedOp.expiry > 0, "UserOp not found");

    // effect
    delete lockedUserOps[hashlock];

    // interaction
    // todo: pass in required `value` / `gas` parameters
    executeUserOp(lockedOp.userOp);
  }

  function executeUserOp(UserOperation memory userOp) internal {
    UserOperation[] memory ops = new UserOperation[](1);
    ops[0] = userOp;
    entryPoint.handleOps(ops, payable(msg.sender));
  }
}
