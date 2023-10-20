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
import { useLogs } from "./useLogs";
import { useBalances } from "./useBalances";
import { ChainLogo } from "./ChainLogo";
import { chains, type ChainName } from "./chains";

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
        // @ts-expect-error
        chain: import.meta.env.VITE_ALICE_CHAIN_URL,
        // @ts-expect-error
        entrypointAddress: import.meta.env.VITE_ALICE_ENTRYPOINT_ADDRESS,
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
        // @ts-expect-error
        entrypointAddress: import.meta.env.VITE_BOB_ENTRYPOINT_ADDRESS,
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
          chain={undefined}
        />
        <br />
        <Stack
          direction="row"
          justifyContent="left"
          alignItems="left"
          spacing={2}
        >
          <Network name={aliceChain.name} clients={[withAlice]} />
          <Divider orientation="vertical" flexItem />
          <Network name={bobChain.name} clients={[withBob]} />
        </Stack>
        <CoordinatorTailLogger coordinator={coordinator} />
      </Stack>
      {/* <Divider /> */}
    </Card>
  );
};

export const Network: React.FunctionComponent<{
  name: ChainName;
  clients: IntermediaryClient[];
}> = (props: { name: ChainName; clients: IntermediaryClient[] }) => {
  return (
    <>
      <Stack
        direction="column"
        justifyContent="left"
        alignItems="left"
        spacing={2}
      >
        <ChainLogo name={props.name} />
        {props.clients.map((client, i) => (
          <>
            {/* render dividers between channels if more than one exists */}
            {i > 0 && <Divider />}
            <IntermediaryChannel key={client.ownerAddress} client={client} />
          </>
        ))}
      </Stack>
    </>
  );
};

export const IntermediaryChannel: React.FunctionComponent<{
  client: IntermediaryClient;
}> = (props: { client: IntermediaryClient }) => {
  const [ownerBalance, intermediaryBalance] = useBalances(props.client);
  return (
    <>
      <Stack
        direction="column"
        justifyContent="left"
        alignItems="left"
        spacing={2}
      >
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
          <Typography>Owner balance: {formatEther(ownerBalance)}</Typography>
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
            IntermediaryBalance: {formatEther(intermediaryBalance)}
          </Typography>
        </Stack>
      </Stack>
    </>
  );
};

export const CoordinatorTailLogger: React.FunctionComponent<{
  coordinator: IntermediaryCoordinator;
}> = (props: { coordinator: IntermediaryCoordinator }) => {
  // log a max of 6 lines
  const [logs] = useLogs(props.coordinator);
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
      <h4>Network Activity</h4>
      <pre>{logs.join("\n")}</pre>
    </Card>
  );
};
