package wallet

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"golang.org/x/crypto/sha3"
)

type ChannelStatus uint8

const (
	ChannelStatusCooperative ChannelStatus = iota
	ChannelStatusChallenge
	ChannelStatusFinalized
	ChannelStatusIndependent
)

type Participant uint8

const (
	ParticipantOwner Participant = iota
	ParticipantIntermediary
)

const CurrentBlockNumber = 0 // todo: replace with a service

var myAddress common.Address = common.Address{} // todo: compute from injected private key - cli? config file?

// ChannelWallet is the off-chain accounting struct for a state channel wallet.
type ChannelWallet struct {
	//////////////////
	// Channel Info //
	//////////////////

	ChannelAddress common.Address

	Owner        common.Address
	Intermediary common.Address

	////////////////////
	// Dynamic State  //
	////////////////////

	Status     ChannelStatus
	TurnNumber uint64

	///////////////////
	// Balances Info //
	///////////////////

	// IntermediaryBalance is the wallet balance that the Intermediary has rights to.
	// The wallet owner implicitly has claim over the rest.
	//
	// This representation is limited to a single-asset channel.
	IntermediaryBalance *big.Int

	// A list of "running" HTLCs. i.e. HTLCs that have been initiated but
	// not yet claimed or expired.
	HTLCs []HTLC
}

// IncrementTurnNumber should be called after every state change a user initiates.
// It returns a SignedChannelState, which can be communicated to the other party.
func (cw *ChannelWallet) IncrementTurnNumber() SignedChannelState {
	cw.TurnNumber++

	return SignedChannelState{
		ChannelState: *cw,
		Signature:    []byte{}, // todo: sign the abi-encoded state
	}
}

func (cw *ChannelWallet) ClearExpiredHTLCs() {
	retainedHTLCs := make([]HTLC, 0, len(cw.HTLCs))

	for _, htlc := range cw.HTLCs {
		// NOT expired - keep it
		if CurrentBlockNumber < htlc.ExpirationBlock {
			retainedHTLCs = append(retainedHTLCs, htlc)
		}
	}

	if len(retainedHTLCs) != len(cw.HTLCs) {
		cw.HTLCs = retainedHTLCs
		cw.IncrementTurnNumber()
	}
}

func (cw *ChannelWallet) ReleaseHTLC(preimage []byte) {
	// Check for a LN compatible preimage
	sha := sha3.New256()
	sha.Write(preimage)
	lnHash := common.Hash(sha.Sum(nil))

	// Check for an EVM compatible preimage
	kec := sha3.NewLegacyKeccak256()
	kec.Write(preimage)
	evmHash := common.Hash(kec.Sum(nil))

	for i, htlc := range cw.HTLCs {
		if htlc.Hash == lnHash || htlc.Hash == evmHash {
			if CurrentBlockNumber >= htlc.ExpirationBlock {
				// Expired - do not honor. Log
				continue
			}

			// increment the intermediary's claimable balance if the intermediary is the recipient.
			//
			// If the owner is the recipient, the owner regains implicit control over the funds
			// previously locked by the HTLC.
			if htlc.ReleaseTo == ParticipantIntermediary {
				cw.IntermediaryBalance.Add(cw.IntermediaryBalance, htlc.Amount)
			}

			// remove the running HTLC
			cw.HTLCs = append(cw.HTLCs[:i], cw.HTLCs[i+1:]...)

			cw.IncrementTurnNumber()
		}
	}
}

// SignedChannelState is a ChannelState with a signature from the owner.
type SignedChannelState struct {
	ChannelState ChannelWallet
	Signature    []byte // todo: add type?
}

// HTLC represents a hash time-locked payment. A payment can be sent by
// either channel participant, and is received by the other participant.
//
// The payment is claimed by the payee with the reveal of the preimage of hash.
type HTLC struct {
	// the Amount of the payment.
	Amount *big.Int
	// 32 byte Hash of the preimage, either keccak256 (evm-only) or SHA256 (LN compatible).
	Hash common.Hash
	// the block number at which the HTLC expires, after which the payer can claim the funds
	// unilaterally.
	ExpirationBlock uint64
	// the participant who will receive the payment
	ReleaseTo Participant
}
