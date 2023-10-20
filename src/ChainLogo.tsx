import React from "react";
import ScrollLogo from "./assets/scroll-logo.svg";
import PolygonLogo from "./assets/polygon-logo.svg";
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
  }
};
