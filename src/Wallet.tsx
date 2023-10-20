/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EjectIcon from "@mui/icons-material/Eject";
import {
  Avatar,
  Box,
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
import { blo } from "blo";
import { formatEther, ethers } from "ethers";
import { OwnerClient } from "../clients/OwnerClient";
import { AddressIcon, AddressIconSmall } from "./AddressIcon";
import "./Wallet.css";
import { type Role } from "./WalletContainer";
import logo from "./assets/logo.png";
import L1PaymentModal from "./modals/L1Payment";
import { useBalances } from "./useBalances";
import EjectModal from "./modals/Eject";
import { chains, type ChainData } from "./chains";
import { ChainLogo } from "./ChainLogo";

let myAddress: string = "placholder";
let mySigningKey: string;
let myPeer: string; // If I'm Alice, this is Bob. If I'm Bob, this is Alice.
let entrypointAddress: string;
let myScwAddress: string;
let myPeerSCWAddress: string;
let myChainUrl: string;
let myChain: ChainData;

const startingIntermediaryBalance = BigInt(
  // @ts-expect-error
  parseInt(import.meta.env.VITE_INTERMEDIARY_BALANCE, 10),
);

const Wallet: React.FunctionComponent<{ role: Role }> = (props: {
  role: Role;
}) => {
  switch (props.role) {
    case "alice":
      // @ts-expect-error
      myAddress = import.meta.env.VITE_ALICE_ADDRESS;
      // @ts-expect-error
      myPeer = import.meta.env.VITE_BOB_ADDRESS;
      // @ts-expect-error
      mySigningKey = import.meta.env.VITE_ALICE_SK;
      // @ts-expect-error
      myScwAddress = import.meta.env.VITE_ALICE_SCW_ADDRESS;
      // @ts-expect-error
      myPeerSCWAddress = import.meta.env.VITE_BOB_SCW_ADDRESS;
      // @ts-expect-error
      myChainUrl = import.meta.env.VITE_ALICE_CHAIN_URL;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      myChain = chains.find(
        // @ts-expect-error
        (c) => c.url === import.meta.env.VITE_ALICE_CHAIN_URL,
      )!;
      // @ts-expect-error
      entrypointAddress = import.meta.env.VITE_ALICE_ENTRYPOINT_ADDRESS;

      break;
    case "bob":
      // @ts-expect-error
      myAddress = import.meta.env.VITE_BOB_ADDRESS;
      // @ts-expect-error
      myPeer = import.meta.env.VITE_ALICE_ADDRESS;
      // @ts-expect-error
      mySigningKey = import.meta.env.VITE_BOB_SK;
      // @ts-expect-error
      myScwAddress = import.meta.env.VITE_BOB_SCW_ADDRESS;
      // @ts-expect-error
      myPeerSCWAddress = import.meta.env.VITE_ALICE_SCW_ADDRESS;
      // @ts-expect-error
      myChainUrl = import.meta.env.VITE_BOB_CHAIN_URL;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      myChain = chains.find(
        // @ts-expect-error
        (c) => c.url === import.meta.env.VITE_BOB_CHAIN_URL,
      )!;
      // @ts-expect-error
      entrypointAddress = import.meta.env.VITE_BOB_ENTRYPOINT_ADDRESS;
      break;
  }

  const [intermediary, setIntermediary] = useState(
    // @ts-expect-error
    import.meta.env.VITE_IRENE_ADDRESS,
  );

  // Default the payment size to 1% of the deposit
  const defaultPaymentSize = // @ts-expect-error
    BigInt(parseInt(import.meta.env.VITE_SCW_DEPOSIT, 10) / 100);

  const [recipient, setRecipient] = useState(myPeerSCWAddress);
  const [hostNetwork, setHostNetwork] = useState("Scroll");
  const [isModalL1PayOpen, setModalL1PayOpen] = useState<boolean>(false);
  const [isModalEjectOpen, setModalEjectOpen] = useState<boolean>(false);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>(
    ethers.formatEther(defaultPaymentSize),
  );
  const [errorL1Pay, setErrorL1Pay] = useState<string | null>(null);

  const handleL1Pay = async (payee: string, amount: bigint): Promise<void> => {
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

  const [wallet, _] = useState(
    () =>
      new OwnerClient({
        signingKey: mySigningKey,
        ownerAddress: myAddress,
        intermediaryAddress: intermediary,
        chainRpcUrl: myChainUrl,
        entrypointAddress,
        scwAddress: myScwAddress,
        startingIntermediaryBalance,
      }),
  );

  const [ownerBalance, intermediaryBalance] = useBalances(wallet);

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

  function paymentLabel(): string {
    return `Amount (${myChain.symbol})`;
  }

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
          spacing={1}
        >
          <AddressIcon address={myScwAddress as `0x${string}`} />

          <ChainLogo name={myChain.name} />
          <Typography>
            {" "}
            <b> Balance:</b> {formatEther(ownerBalance)}{" "}
          </Typography>
          <Typography>
            {" "}
            <b> Inbound Capacity:</b> {formatEther(intermediaryBalance)}{" "}
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
                        setRecipient(myPeerSCWAddress);
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
            <Container maxWidth="xs">
              <TextField
                fullWidth
                label={paymentLabel()}
                id="outlined-start-adornment"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                }}
                sx={{ m: 1, width: "25ch" }}
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
                  void handleL1Pay(recipient, ethers.parseEther(payAmount));
                }}
              >
                <AccessTimeIcon style={{ marginRight: "5px" }} /> L1 Pay
              </Button>
              <Button
                size="medium"
                disabled={
                  recipient.toLowerCase() !== myPeerSCWAddress.toLowerCase()
                }
                onClick={() => {
                  wallet
                    .pay(recipient, ethers.parseEther(payAmount))
                    .catch((e) => {
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
              amount={Number(payAmount)}
              payee={recipient}
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
            <ButtonGroup variant="outlined" aria-label="outlined button group">
              <Button
                size="medium"
                onClick={() => {
                  setModalEjectOpen(true);
                }}
              >
                <EjectIcon style={{ marginRight: "5px" }} /> Eject
              </Button>
            </ButtonGroup>
            <EjectModal
              isOpen={isModalEjectOpen}
              onClose={() => {
                setModalEjectOpen(false);
              }}
            />
          </Stack>
        </Stack>
      </Card>
    </ThemeProvider>
  );
};

export default Wallet;
