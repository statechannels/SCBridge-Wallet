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

export type ChainID = bigint;

export const chains: ChainData[] = [
  {
    url: "http://localhost:8545",
    chainID: 31337n,
    name: "hardhat 1",
    symbol: "hh1ETH",
    explorer: "",
    exchangeRate: 1,
  },
  {
    url: "http://localhost:8546",
    chainID: 31338n,
    name: "hardhat 2",
    symbol: "hh2ETH",
    explorer: "",
    exchangeRate: 2,
  },
  {
    chainID: 534351n,
    url: "https://sepolia-rpc.scroll.io",
    name: "scroll",
    symbol: "ETH",
    explorer: "",
    exchangeRate: 1,
  },
  {
    name: "Polygon zkEVM Testnet",
    symbol: "polyETH",
    url: "https://rpc.public.zkevm-test.net",
    chainID: 1442n,
    explorer: "https://mumbai.polygonscan.com/",
    exchangeRate: 1,
  },
  {
    name: "Filecoin Calibration Testnet",
    symbol: "tFIL",
    url: "https://api.calibration.node.glif.io/rpc/v1",
    chainID: 314159n,
    explorer: "https://beryx.zondax.ch/",
    exchangeRate: 1,
  },
  {
    name: "Mantle Testnet",
    symbol: "MNT",
    url: "https://rpc.testnet.mantle.xyz",
    chainID: 5001n,
    explorer: "https://testnet.mantlescan.org/",
    exchangeRate: 1,
  },
  {
    name: "Sepolia Testnet",
    symbol: "ETH",
    url: "https://rpc-sepolia.rockx.com",
    chainID: 11155111n,
    explorer: "https://sepolia.etherscan.io/",
    exchangeRate: 1,
  },
];
