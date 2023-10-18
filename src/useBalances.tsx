import { useState, useEffect } from "react";
import { type StateChannelWallet } from "../clients/StateChannelWallet";
import { UI_UPDATE_PERIOD } from "./constants";

export function useBalances(client: StateChannelWallet): [number, number] {
  const [ownerBalance, setOwnerBalance] = useState(0);
  const [intermediaryBalance, setIntermediaryBalance] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      client
        .getOwnerBalance()
        .then((b) => {
          setOwnerBalance(Number(b));
        })
        .catch((e) => {
          console.error(e);
        });
      setIntermediaryBalance(Number(client.intermediaryBalance));
    }, UI_UPDATE_PERIOD);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return [ownerBalance, intermediaryBalance];
}
