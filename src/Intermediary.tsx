/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState } from "react";
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
import { formatEther } from "ethers";
import { useBalances } from "./useBalances";
import { ChainData, chains } from "./chains";

const startingIntermediaryBalance = BigInt(
  // @ts-expect-error
  parseInt(import.meta.env.VITE_INTERMEDIARY_BALANCE, 10),
);
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const aliceChain = chains.find(
    // @ts-expect-error
    (c) => c.url === import.meta.env.VITE_ALICE_CHAIN_URL,
  )!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const bobChain = chains.find(
    // @ts-expect-error
    (c) => c.url === import.meta.env.VITE_BOB_CHAIN_URL,
  )!;

  const [withAlice] = useState(
    () =>
      new IntermediaryClient({
        signingKey: myKey,
        // @ts-expect-error
        ownerAddress: import.meta.env.VITE_ALICE_ADDRESS,
        intermediaryAddress: myAddress,
        // @ts-expect-error
        chainRpcUrl: import.meta.env.VITE_ALICE_CHAIN_URL,
        entrypointAddress,
        scwAddress: aliceScwAddress,
        startingIntermediaryBalance,
      }),
  );
  const [withBob] = useState(
    () =>
      new IntermediaryClient({
        signingKey: myKey,
        // @ts-expect-error
        ownerAddress: import.meta.env.VITE_BOB_ADDRESS,
        intermediaryAddress: myAddress,
        // @ts-expect-error
        chainRpcUrl: import.meta.env.VITE_BOB_CHAIN_URL,
        entrypointAddress,
        scwAddress: bobScwAddress,
        startingIntermediaryBalance,
      }),
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [coordinator] = useState(
    () => new IntermediaryCoordinator([withAlice, withBob]),
  );

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
        <Intermediary client={withAlice} chain={aliceChain} />
        <Divider />
        <Intermediary client={withBob} chain={bobChain} />
      </Stack>
    </Card>
  );
};

export const Intermediary: React.FunctionComponent<{
  client: IntermediaryClient;
  chain: ChainData;
}> = (props: { client: IntermediaryClient; chain: ChainData }) => {
  const [ownerBalance, intermediaryBalance] = useBalances(props.client);
  return (
    <>
      {props.chain.name}
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
          Owner balance:{" "}
          {formatEther(BigInt(ownerBalance)) + " " + props.chain.symbol}
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
          IntermediaryBalance:{" "}
          {formatEther(BigInt(intermediaryBalance)) + " " + props.chain.symbol}
        </Typography>
      </Stack>
    </>
  );
};
