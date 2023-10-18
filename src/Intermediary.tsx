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
import { UI_UPDATE_PERIOD } from "./constants";
import { formatEther } from "ethers";

export const Coordinator: React.FunctionComponent = () => {
  // @ts-expect-error
  const myAddress = import.meta.env.VITE_IRENE_ADDRESS;
  // @ts-expect-error
  const myKey = import.meta.env.VITE_IRENE_SK;
  // @ts-expect-error
  const entrypointAddress = import.meta.env.VITE_ENTRYPOINT_ADDRESS;
  // @ts-expect-error
  const aliceScwAddress = import.meta.env.VITE_ALICE_SCW_ADDRESS;
  // @ts-expect-error
  const bobScwAddress = import.meta.env.VITE_BOB_SCW_ADDRESS;

  const [withAlice] = useState(
    new IntermediaryClient({
      signingKey: myKey,
      // @ts-expect-error
      ownerAddress: import.meta.env.VITE_ALICE_ADDRESS,
      intermediaryAddress: myAddress,
      chainRpcUrl: "http://localhost:8545",
      entrypointAddress,
      scwAddress: aliceScwAddress,
    }),
  );
  const [withBob] = useState(
    new IntermediaryClient({
      signingKey: myKey,
      // @ts-expect-error
      ownerAddress: import.meta.env.VITE_BOB_ADDRESS,
      intermediaryAddress: myAddress,
      chainRpcUrl: "http://localhost:8545",
      entrypointAddress,
      scwAddress: bobScwAddress,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [coordinator] = useState(
    new IntermediaryCoordinator([withAlice, withBob]),
  );

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
      <Stack
        direction="column"
        justifyContent="center"
        alignItems="center"
        spacing={2}
      >
        <AddressIcon
          address={
            // @ts-expect-error
            import.meta.env.VITE_IRENE_ADDRESS as `0x${string}`
          }
        />
      </Stack>
      <br />
      <Stack
        direction="column"
        justifyContent="left"
        alignItems="left"
        spacing={2}
      >
        <Divider />
        <Intermediary client={withAlice} />
        <Divider />
        <Intermediary client={withBob} />
      </Stack>
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
    }, UI_UPDATE_PERIOD);
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
        <Typography>
          Owner balance: {formatEther(BigInt(ownerBalance))}
        </Typography>
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
        <Typography>
          IntermediaryBalance: {formatEther(BigInt(intermediaryBalance))}
        </Typography>
      </Stack>
    </>
  );
};
