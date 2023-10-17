/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
import L1PaymentModal from "./modals/L1Payment";
import { OwnerClient } from "../clients/OwnerClient";
import { AddressIcon, AddressIconSmall } from "./AddressIcon";
import { blo } from "blo";
import { PAYMENT_AMOUNT, UI_UPDATE_PERIOD } from "./constants";

let myAddress: string = "placholder";
let mySigningKey: string;
let myPeer: string; // If I'm Alice, this is Bob. If I'm Bob, this is Alice.
// @ts-expect-error
const entrypointAddress = import.meta.env.VITE_ENTRYPOINT_ADDRESS;
let myScwAddress: string;

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
      // @ts-expect-error
      myScwAddress = import.meta.env.VITE_ALICE_SCW_ADDRESS ?? "";
      break;
    case "bob":
      // @ts-expect-error
      myAddress = import.meta.env.VITE_BOB_ADDRESS ?? "";
      // @ts-expect-error
      myPeer = import.meta.env.VITE_ALICE_ADDRESS ?? "";
      // @ts-expect-error
      mySigningKey = import.meta.env.VITE_BOB_SK ?? "";
      // @ts-expect-error
      myScwAddress = import.meta.env.VITE_BOB_SCW_ADDRESS ?? "";
      break;
  }

  const [intermediary, setIntermediary] = useState(
    // @ts-expect-error
    import.meta.env.VITE_IRENE_ADDRESS ?? "",
  );
  const [intermediaryBalance, setIntermediaryBalance] = useState(0);
  const [ownerBalance, setOwnerBalance] = useState(0);
  const [recipient, setRecipient] = useState(myPeer);
  const [hostNetwork, setHostNetwork] = useState("Scroll");
  const [isModalL1PayOpen, setModalL1PayOpen] = useState<boolean>(false);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0.5);
  const [errorL1Pay, setErrorL1Pay] = useState<string | null>(null);

  const handleL1Pay = async (payee: string, amount: number): Promise<void> => {
    try {
      const resultHash = await wallet.payL1(payee, amount);
      setUserOpHash(resultHash);
      setErrorL1Pay(null); // Clear any previous error
      setModalL1PayOpen(true);
    } catch (e: any) {
      console.error(e);
      setErrorL1Pay("Error initiating L1 payment");
    } finally {
      setModalL1PayOpen(true);
    }
  };

  const wallet = new OwnerClient({
    signingKey: mySigningKey,
    ownerAddress: myAddress,
    intermediaryAddress: intermediary,
    chainRpcUrl: "http://localhost:8545",
    entrypointAddress,
    scwAddress: myScwAddress,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      wallet
        .getOwnerBalance()
        .then((b) => {
          setOwnerBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
      wallet
        .getIntermediaryBalance()
        .then((b) => {
          setIntermediaryBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
    }, UI_UPDATE_PERIOD);
    return () => {
      clearInterval(interval);
    };
  }, []);

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
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="center"
          spacing={2}
        >
          <AddressIcon address={myAddress as `0x${string}`} />

          <Typography> Host Network: {hostNetwork}</Typography>
          <Typography>
            Balance: {ownerBalance} / Inbound Capacity: {intermediaryBalance}
          </Typography>
        </Stack>
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
                label="Recipient"
                id="outlined-start-adornment"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                }}
                sx={{ m: 1, width: "25ch" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment
                      position="start"
                      onClick={() => {
                        setRecipient(myPeer);
                      }}
                    >
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
              <Button
                size="medium"
                disabled={recipient === ""}
                onClick={() => {
                  void handleL1Pay(myPeer, PAYMENT_AMOUNT);
                }}
              >
                <AccessTimeIcon style={{ marginRight: "5px" }} /> L1 Pay
              </Button>
              <Button
                size="medium"
                disabled={recipient.toLowerCase() !== myPeer.toLowerCase()}
                onClick={() => {
                  wallet.pay(myPeer, PAYMENT_AMOUNT).catch((e) => {
                    console.error(e);
                  });
                }}
              >
                <BoltIcon /> L2 Pay
              </Button>
            </ButtonGroup>

            <L1PaymentModal
              isOpen={isModalL1PayOpen}
              onClose={() => {
                setModalL1PayOpen(false);
              }}
              errorMessage={errorL1Pay}
              userOpHash={userOpHash}
              amount={payAmount}
              payee={myPeer}
            />
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
