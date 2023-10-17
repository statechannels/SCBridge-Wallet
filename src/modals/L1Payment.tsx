import React from "react";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { Dialog, DialogContent, DialogTitle } from "@mui/material";

interface L1PaymentProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string | null;
  userOpHash: string | null;
  amount: number;
  payee: string;
}

const L1PaymentModal: React.FC<L1PaymentProps> = ({
  isOpen,
  onClose,
  errorMessage,
  userOpHash,
  amount,
  payee,
}) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        <HourglassEmptyIcon
          style={{ marginRight: "10px", verticalAlign: "middle" }}
        />
        Transaction created
      </DialogTitle>
      <DialogContent>
        {errorMessage ??
          `Initiated transfer of ${amount} ETH to ${payee} (userOpHash: ${userOpHash})`}
      </DialogContent>
    </Dialog>
  );
};

export default L1PaymentModal;
