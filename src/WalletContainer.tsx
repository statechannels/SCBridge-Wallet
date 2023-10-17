/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from "@mui/material";

import React, { useState } from "react";
import Wallet from "./Wallet";
import { Coordinator } from "./Intermediary";

export type Role = "alice" | "bob" | "irene" | undefined;

const WalletContainer: React.FunctionComponent = () => {
  const [role, setRole] = useState<Role>(undefined);
  return (
    <div>
      {role === undefined ? (
        <ChooseRole setRole={setRole} />
      ) : role === "irene" ? (
        <Coordinator />
      ) : (
        <Wallet role={role} />
      )}
    </div>
  );
};

export default WalletContainer;

const ChooseRole: React.FunctionComponent<{
  setRole: (r: Role) => void;
}> = (props: { setRole: (r: Role) => void }) => {
  return (
    <div>
      <Button
        onClick={() => {
          props.setRole("alice");
        }}
      >
        Alice
      </Button>
      <Button
        onClick={() => {
          props.setRole("irene");
        }}
      >
        Irene
      </Button>
      <Button
        onClick={() => {
          props.setRole("bob");
        }}
      >
        Bob
      </Button>
    </div>
  );
};
