import { Avatar, Snackbar, Tooltip } from "@mui/material";
import { blo } from "blo";
import React, { useState, type FunctionComponent } from "react";

export const AddressIcon: FunctionComponent<{
  address: `0x${string}`;
}> = (props: { address: `0x${string}` }) => {
  const [open, setOpen] = useState(false);

  // stolen from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript#30810322
  function copy(text: string): undefined {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        setOpen(true);
      }
    } catch (err) {
      console.error("Fallback: Oops, unable to copy", err);
    }

    document.body.removeChild(textArea);
    return undefined;
  }

  return (
    <div>
      <Tooltip title={props.address}>
        <Avatar
          {...props}
          src={blo(props.address)}
          sx={{ width: 48, height: 48 }}
          onClick={() => {
            copy(props.address);
          }}
        ></Avatar>
      </Tooltip>
      <Snackbar
        open={open}
        autoHideDuration={1500}
        onClose={() => {
          setOpen(false);
        }}
        message={(() => {
          return `Copied ${props.address}`;
        })()}
      />
    </div>
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
