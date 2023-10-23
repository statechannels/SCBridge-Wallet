import React from "react";
import ScrollLogo from "./assets/scroll-logo.svg";
import PolygonLogo from "./assets/polygon-logo.svg";
import MantleLogo from "./assets/mantle-logo.svg";
import FilecoinLogo from "./assets/filecoin-logo.svg";
import EthLogo from "./assets/eth-logo.svg";

import { type ChainName } from "./chains";

export const ChainLogo: React.FunctionComponent<{
  name: ChainName;
}> = (props: { name: ChainName }) => {
  switch (props.name) {
    case "Hardhat A":
    case "Hardhat B":
      return <b>{props.name}</b>;
    case "Polygon zkEVM Testnet":
      return <img src={PolygonLogo} height={40} />;
    case "scroll":
      return <img src={ScrollLogo} height={40} />;
    case "filecoin":
      return <img src={FilecoinLogo} height={40} />;
    case "mantle":
      return <img src={MantleLogo} height={40} />;
    case "goerli":
      return <img src={EthLogo} height={40} />;
    case "sepolia":
      return <img src={EthLogo} height={40} />;
  }
};
