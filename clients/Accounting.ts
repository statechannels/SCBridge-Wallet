import { chains, type ChainID } from "../src/chains";
import { type Invoice } from "./Messages";

export function convertInvoice(invoice: Invoice, to: ChainID): Invoice {
  if (invoice.chain === to) {
    return invoice;
  }

  const sourceChain = chains.find((c) => c.chainID === invoice.chain);
  if (sourceChain === undefined) {
    throw new Error(
      `Failed to find chain data for provided invoice. ChainID: ${invoice.chain}`,
    );
  }
  const targetChain = chains.find((c) => c.chainID === to);
  if (targetChain === undefined) {
    throw new Error(`Failed to find chain data for chainID: ${to}`);
  }

  const usdValue = Number(invoice.amount) * sourceChain.exchangeRate; // todo: do we expect overflows here?
  const targetChainValue = usdValue / targetChain.exchangeRate; // usd / (usd/targetCurrency) == targetCurrency

  return {
    ...invoice,
    chain: targetChain.chainID,
    amount: BigInt(targetChainValue),
  };
}
