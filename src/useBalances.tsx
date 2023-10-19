import { useState, useEffect } from "react";
import { type StateChannelWallet } from "../clients/StateChannelWallet";
import { UI_UPDATE_PERIOD } from "./constants";

export function useBalances(client: StateChannelWallet): [bigint, bigint] {
  const [ownerBalance, setOwnerBalance] = useState(0n);
  const [intermediaryBalance, setIntermediaryBalance] = useState(0n);
  useEffect(() => {
    const interval = setInterval(() => {
      client
        .getOwnerBalance()
        .then((b) => {
          setOwnerBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
      setIntermediaryBalance(client.intermediaryBalance);
    }, UI_UPDATE_PERIOD);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return [ownerBalance, intermediaryBalance];
}
