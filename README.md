<h1 align="center">
<div><img src="./SCBridge-Wallet.png"><br>
SCBridge-Wallet
</h1>
<h3 align="center">
An L2 state channel bridge contract which is also an L1 smart contract wallet.
</h3>

### Ingredients

This repo contains Solidity source code for a novel type of state channel bridge smart contract. It offers the unique feature that deposited funds can not only be used to send offchain payments to other channel network participants with zero fees and instant finality, but also to send arbitrary transactions on the underlying L1 blockchain without having to withdraw them first in a separate transaction.

This functionality is achieved by inviting a channel network peer to be a co-signatory "guest" on your smart contract wallet. L1 transactions are first send to that "guest", who countersigns them and submits them to the mempool. The guest therefore plays a role similar to an EIP 4337 "bundler" (only simpler, and with a peer-to-peer private "mempool"). Although the "guest" can be ejected at any time (and then either replaced with another guest, or not), they have the right to veto any L1 transaction. This allows them to ensure they retain any off chain payments promised to them by the wallet owner. If they are ejected, they get to take that money with them.

By having that guest perform the same role in several users' smart contract wallets, the off chain payments can be routed over arbitrary hops through a payment network (a la Bitcoin Lightning).

This repo also contains Typescript source code for off-chain clients that can be run by a user and by a guest, to enable to orchestrate the functionality described above.

### Method

#### User

#### Guest
