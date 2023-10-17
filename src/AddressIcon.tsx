import { Tooltip } from "@mui/material";
import { blo } from "blo";
import React, { type FunctionComponent } from "react";

export const AddressIcon: FunctionComponent<{
  address: `0x${string}`;
}> = (props: { address: `0x${string}` }) => {
  return (
    <Tooltip title={props.address}>
      <img alt={props.address} src={blo(props.address)} />
    </Tooltip>
  );
};
