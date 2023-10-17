/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from "react";
export const Intermediary: React.FunctionComponent = () => {
  // @ts-expect-error
  return <h1>Intermediary: {import.meta.env.VITE_IRENE_ADDRESS}</h1>;
};
