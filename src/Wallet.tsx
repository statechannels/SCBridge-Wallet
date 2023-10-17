/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import logo from "./assets/logo.png";
import "./Wallet.css";
import {
  Avatar,
  Button,
  ButtonGroup,
  Card,
  Container,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import { type Role } from "./WalletContainer";
import { MessageType, type Message } from "../clients/Messages";
import { OwnerClient } from "../clients/OwnerClient";
import { AddressIcon, AddressIconSmall } from "./AddressIcon";
import { blo } from "blo";

let myAddress: string = "placholder";
let mySigningKey: string;
let myPeer: string; // If I'm Alice, this is Bob. If I'm Bob, this is Alice.

const Wallet: React.FunctionComponent<{ role: Role }> = (props: {
  role: Role;
}) => {
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

  const [intermediary, setIntermediary] = useState(
    // @ts-expect-error
    import.meta.env.VITE_IRENE_ADDRESS ?? "",
  );
  const [inboundCapacity, setInboundCapacity] = useState(0);
  const [balance, setBalance] = useState(0);
  const [recipient, setRecipient] = useState(myPeer);
  const [hostNetwork, setHostNetwork] = useState("Scroll");

  const wallet = new OwnerClient({
    signingKey: mySigningKey,
    ownerAddress: myAddress,
    intermediaryAddress: intermediary,
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
      <Card
        variant="outlined"
        sx={{
          bgcolor: "background.paper",
          boxShadow: 1,
          borderRadius: 2,
          p: 2,
          minWidth: 300,
        }}
      >
        <div>
          <img
            src={logo}
            className="logo"
            alt="SCBridge-Wallet Logo"
            style={{ height: "25vh" }}
          />
        </div>
        <h2>SCBridge-Wallet</h2>
        <AddressIcon address={myAddress as `0x${string}`} />

        <Typography> Host Network: {hostNetwork}</Typography>
        <Typography>
          Balance: {balance} / Inbound Capacity: {inboundCapacity}
        </Typography>
        <br />
        <Stack direction="column" spacing={2}>
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={2}
          >
            <Container maxWidth="xs">
              <TextField
                fullWidth
                label="Payee"
                id="outlined-start-adornment"
                defaultValue={myPeer}
                onChange={(e) => {
                  setRecipient(e.target.value);
                }}
                sx={{ m: 1, width: "25ch" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AddressIconSmall address={recipient as `0x${string}`} />
                    </InputAdornment>
                  ),
                }}
              />
            </Container>
          </Stack>
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={2}
          >
            <ButtonGroup variant="outlined" aria-label="outlined button group">
              <Button size="medium" disabled={recipient === ""}>
                L1 Pay
              </Button>
              <Button
                size="medium"
                onClick={() => {
                  wallet.pay(myPeer, 19).catch((e) => {
                    console.error(e);
                  });
                }}
                disabled={recipient.toLowerCase() !== myPeer.toLowerCase()}
              >
                <BoltIcon /> L2 Pay
              </Button>
            </ButtonGroup>
          </Stack>
          <Divider />
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={2}
          >
            <Typography>Intermediary: </Typography>
            <Tooltip title={intermediary} placement="top">
              <Avatar
                src={blo(intermediary as `0x${string}`)}
                sx={{ width: 24, height: 24 }}
              />
            </Tooltip>
            <Button>Eject</Button>
          </Stack>
        </Stack>
      </Card>
    </ThemeProvider>
  );
};

export default Wallet;
