import React, { useState } from "react";
import logo from "./assets/logo.png";
import "./App.css";
import {
  Button,
  ButtonGroup,
  InputAdornment,
  OutlinedInput,
  TextField,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from "@mui/material";

function App() {
  const [intermediary, setIntermediary] = useState("0xabc");
  const [inboundCapacity, setInboundCapacity] = useState(0);
  const [balance, setBalance] = useState(0);
  const [recipient, setRecipient] = useState("0xbob");

  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode]
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
      <div className="card">
        <p>Balance: {balance}</p>
        <p> Inbound Capacity: {inboundCapacity}</p>
        <TextField
          label="Payee"
          id="outlined-start-adornment"
          defaultValue="0xbob"
          onChange={(e) => setRecipient(e.target.value)}
          sx={{ m: 1, width: "25ch" }}
        />{" "}
        <ButtonGroup variant="outlined" aria-label="outlined button group">
          <Button>L1 Pay</Button>
          <Button>L2 Pay</Button>
        </ButtonGroup>
        <p>Intermediary: {intermediary}</p>
        <Button>Eject</Button>
      </div>
    </ThemeProvider>
  );
}

export default App;
