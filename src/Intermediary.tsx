/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from "react";
import logo from "./assets/logo.png";
import { IntermediaryClient } from "../clients/IntermediaryClient";
export const Intermediary: React.FunctionComponent = () => {
  const [ownerBalance, setOwnerBalance] = useState(0);
  const [intermediaryBalance, setIntermediaryBalance] = useState(0);
  const client = new IntermediaryClient({
    // @ts-expect-error
    signingKey: import.meta.env.VITE_IRENE_SK,
    chainRpcUrl: "",
    entrypointAddress: "",
    scwAddress: "",
  });

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
      client
        .getIntermediaryBalance()
        .then((b) => {
          setIntermediaryBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
    }, 400);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <img
        src={logo}
        className="logo"
        alt="SCBridge-Wallet Logo"
        style={{ height: "25vh" }}
      />
      <h1>Intermediary</h1>

      <h2>
        {
          // @ts-expect-error
          import.meta.env.VITE_IRENE_ADDRESS
        }
      </h2>
      <div className="card">
        <p>Owner balance: {ownerBalance}</p>
        <p>Intermediary balance: {intermediaryBalance}</p>
      </div>
    </>
  );
};
