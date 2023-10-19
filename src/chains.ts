export interface ChainData {
  /**
   * the RPC endpoint that a provider should be pointed to. EG, http://localhost:8548 for
   * a default hardhat node
   */
  url: string;
  /**
   * the chainID.
   */
  chainID: ChainID;
  /**
   * The name of the chain. Populates eg, the "Host Network" UI field for channel wallets.
   */
  name: string;
  /**
   * The 'ticker' symbol for the chain. Populates eg, the "Amount (ETH)" field for setting transactions.
   */
  symbol: string; // the 'ticker symbol' for the chain
  /**
   * A link to a block explorer for the chain. (eg, https://etherscan.io for Ethereum)
   */
  explorer: string;
  /**
   * The value of the chain's native token in USD. Permits cross-chain exchange rate calculations.
   */
  exchangeRate: number;
}

export type ChainID = number;

export const chains: ChainData[] = [
  {
    url: "http://localhost:8545",
    chainID: 31337,
    name: "hardhat 1",
    symbol: "hh1ETH",
    explorer: "",
    exchangeRate: 1,
  },
  {
    url: "http://localhost:8546",
    chainID: 31338,
    name: "hardhat 2",
    symbol: "hh2ETH",
    explorer: "",
    exchangeRate: 2,
  },
];
