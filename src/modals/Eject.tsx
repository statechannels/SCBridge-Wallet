import React from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface EjectProps {
  isOpen: boolean;
  onClose: () => void;
}

const EjectModal: React.FC<EjectProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        <WarningAmberIcon
          style={{ marginRight: "10px", verticalAlign: "middle" }}
        />
        Eject Intermediary
      </DialogTitle>
      <DialogContent>
        <Box>
          <Typography variant="h6" color="error">
            Eject feature is not fully implemented
          </Typography>
          <br></br>
          <Typography variant="body1">
            If implemented, this would initiate a challenge where the
            SCBridge-Wallet owner sends its latest known state on-chain and the
            Intermediary has a timeout period where they can respond with their
            latest state if it has a higher turn number.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EjectModal;
