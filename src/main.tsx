import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import WalletContainer from "./WalletContainer";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletContainer />
  </React.StrictMode>
);
