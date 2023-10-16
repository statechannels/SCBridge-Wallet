/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from "@mui/material";

import React, { useState } from "react";
import Wallet from "./Wallet";

export type Role = "alice" | "bob" | "irene" | undefined;

const WalletContainer: React.FunctionComponent<{ role: Role }> = (props: {
  role: Role;
}) => {
  const [role, setRole] = useState<Role>(undefined);
  return (
    <div>
      {role != undefined ? (
        <Wallet role={role} />
      ) : (
        <ChooseRole setRole={setRole} />
      )}
    </div>
  );
};

export default WalletContainer;

const ChooseRole: React.FunctionComponent<{
  setRole: (r: Role) => void;
}> = (props: { setRole: (r: Role) => void }) => {
  type role = "alice" | "bob" | "irene" | undefined;

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
          props.setRole("bob");
        }}
      >
        BOb
      </Button>
    </div>
  );
};
