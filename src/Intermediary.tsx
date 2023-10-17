/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from "react";
import {
  IntermediaryClient,
  IntermediaryCoordinator,
} from "../clients/IntermediaryClient";
import { AddressIcon } from "./AddressIcon";
import {
  Avatar,
  Card,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { blo } from "blo";

export const Coordinator: React.FunctionComponent = () => {
  // @ts-expect-error
  const myAddress = import.meta.env.VITE_IRENE_ADDRESS;
  // @ts-expect-error
  const myKey = import.meta.env.VITE_IRENE_SK;

  const withAlice = new IntermediaryClient({
    signingKey: myKey,
    // @ts-expect-error
    ownerAddress: import.meta.env.VITE_ALICE_ADDRESS,
    intermediaryAddress: myAddress,
    chainRpcUrl: "",
    entrypointAddress: "",
    scwAddress: "",
  });
  const withBob = new IntermediaryClient({
    signingKey: myKey,
    // @ts-expect-error
    ownerAddress: import.meta.env.VITE_BOB_ADDRESS,
    intermediaryAddress: myAddress,
    chainRpcUrl: "",
    entrypointAddress: "",
    scwAddress: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const coordinator: IntermediaryCoordinator = new IntermediaryCoordinator([
    withAlice,
    withBob,
  ]);

  console.log(withAlice.ownerAddress);

  return (
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
      <h2>Coordinator</h2>
      <AddressIcon
        address={
          // @ts-expect-error
          import.meta.env.VITE_IRENE_ADDRESS as `0x${string}`
        }
      />
      <Divider />
      <Intermediary client={withAlice} />
      <Divider />
      <Intermediary client={withBob} />
    </Card>
  );
};

export const Intermediary: React.FunctionComponent<{
  client: IntermediaryClient;
}> = (props: { client: IntermediaryClient }) => {
  const [ownerBalance, setOwnerBalance] = useState(0);
  const [intermediaryBalance, setIntermediaryBalance] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      props.client
        .getOwnerBalance()
        .then((b) => {
          setOwnerBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
      props.client
        .getIntermediaryBalance()
        .then((b) => {
          setIntermediaryBalance(b);
        })
        .catch((e) => {
          console.error(e);
        });
    }, 400);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Stack
        direction="row"
        justifyContent="left"
        alignItems="center"
        spacing={2}
      >
        <Tooltip title={props.client.ownerAddress} placement="top">
          <Avatar
            src={blo(props.client.ownerAddress as `0x${string}`)}
            sx={{ width: 24, height: 24 }}
          />
        </Tooltip>
        <Typography>Owner balance: {ownerBalance}</Typography>
      </Stack>
      <Stack
        direction="row"
        justifyContent="left"
        alignItems="center"
        spacing={2}
      >
        <Tooltip title={props.client.intermediaryAddress} placement="top">
          <Avatar
            src={blo(props.client.intermediaryAddress as `0x${string}`)}
            sx={{ width: 24, height: 24 }}
          />
        </Tooltip>
        <Typography>IntermediaryBalance: {intermediaryBalance}</Typography>
      </Stack>
    </>
  );
};
