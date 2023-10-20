import { Avatar, Tooltip } from "@mui/material";
import { blo } from "blo";
import React, { type FunctionComponent } from "react";
import { type ChainData } from "./chains";

export const AddressIcon: FunctionComponent<{
  address: `0x${string}`;
  chain?: ChainData;
}> = (props: { address: `0x${string}`; chain?: ChainData }) => {
  return props.chain !== undefined ? (
    <Tooltip title={props.address}>
      <a
        href={props.chain.explorer + "address/" + props.address}
        target="_blank"
      >
        <Avatar
          {...props}
          src={blo(props.address)}
          sx={{ width: 48, height: 48 }}
        ></Avatar>
      </a>
    </Tooltip>
  ) : (
    <Tooltip title={props.address}>
      <Avatar
        {...props}
        src={blo(props.address)}
        sx={{ width: 48, height: 48 }}
      ></Avatar>
    </Tooltip>
  );
};

export const AddressIconSmall: FunctionComponent<{
  address: `0x${string}`;
}> = (props: { address: `0x${string}` }, ref) => {
  return (
    <Avatar
      {...props}
      src={blo(props.address)}
      sx={{ width: 24, height: 24 }}
    />
  );
};
