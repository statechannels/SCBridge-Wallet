import React from "react";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

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
        {errorMessage != null ? (
          <Typography color="error" variant="body1">
            {errorMessage}
          </Typography>
        ) : (
          <Box>
            <Typography variant="body1">
              Initiated transfer of <b>{amount} ETH</b> to
            </Typography>
            <Typography
              color="primary"
              variant="body2"
              style={{ wordBreak: "break-all" }}
            >
              {payee}
            </Typography>
            <Typography variant="body1" style={{ marginTop: "8px" }}>
              User Operation Hash:
            </Typography>
            <Typography
              color="primary"
              variant="body2"
              style={{ wordBreak: "break-all" }}
            >
              {userOpHash}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default L1PaymentModal;
