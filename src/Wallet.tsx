/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import logo from "./assets/logo.png";
import "./Wallet.css";
import {
  Button,
  ButtonGroup,
  TextField,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import { type Role } from "./WalletContainer";
import { MessageType, type Message } from "../clients/Messages";
import { OwnerClient } from "../clients/OwnerClient";

let myAddress: string = "placholder";
let mySigningKey: string;
let myPeer: string; // If I'm Alice, this is Bob. If I'm Bob, this is Alice.

const Wallet: React.FunctionComponent<{ role: Role }> = (props: {
  role: Role;
}) => {
  const [intermediary, setIntermediary] = useState("0xabc");
  const [inboundCapacity, setInboundCapacity] = useState(0);
  const [balance, setBalance] = useState(0);
  const [recipient, setRecipient] = useState("0xbob");
  const [hostNetwork, setHostNetwork] = useState("Scroll");

  switch (props.role) {
    case "alice":
      // @ts-expect-error
      myAddress = import.meta.env.VITE_ALICE_ADDRESS ?? "";
      // @ts-expect-error
      myPeer = import.meta.env.VITE_BOB_ADDRESS ?? "";
      // @ts-expect-error
      mySigningKey = import.meta.env.VITE_ALICE_SK ?? "";

      break;
    case "bob":
      // @ts-expect-error
      myAddress = import.meta.env.VITE_BOB_ADDRESS ?? "";
      // @ts-expect-error
      myPeer = import.meta.env.VITE_ALICE_ADDRESS ?? "";
      // @ts-expect-error
      mySigningKey = import.meta.env.VITE_BOB_SK ?? "";
      break;
  }

  const wallet = new OwnerClient({
    signingKey: mySigningKey,
    chainRpcUrl: "",
    entrypointAddress: "",
    scwAddress: "",
  });

  const message: Message = {
    type: MessageType.RequestInvoice,
    amount: 1987,
    from: myAddress,
  };

  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <div>
        <img
          src={logo}
          className="logo"
          alt="SCBridge-Wallet Logo"
          style={{ height: "25vh" }}
        />
      </div>
      <h1>SCBridge-Wallet</h1>
      <h2>{myAddress}</h2>
      <div className="card">
        <p> Host Network: {hostNetwork}</p>
        <p>Balance: {balance}</p>
        <p> Inbound Capacity: {inboundCapacity}</p>
        <TextField
          label="Payee"
          id="outlined-start-adornment"
          defaultValue={myPeer}
          onChange={(e) => {
            setRecipient(e.target.value);
          }}
          sx={{ m: 1, width: "25ch" }}
        />{" "}
        <ButtonGroup variant="outlined" aria-label="outlined button group">
          <Button>L1 Pay</Button>
          <Button
            onClick={() => {
              wallet.pay(myPeer, 19).catch((e) => {
                console.error(e);
              });
            }}
          >
            L2 Pay
          </Button>
        </ButtonGroup>
        <p>Intermediary: {intermediary}</p>
        <Button>Eject</Button>
      </div>
    </ThemeProvider>
  );
};

export default Wallet;
