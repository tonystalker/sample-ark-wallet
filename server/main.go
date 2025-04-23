package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	log "github.com/sirupsen/logrus"

	"github.com/ark-network/ark/common"
	arksdk "github.com/ark-network/ark/pkg/client-sdk"
	explorer "github.com/ark-network/ark/pkg/client-sdk/explorer"
	store "github.com/ark-network/ark/pkg/client-sdk/store"
	types "github.com/ark-network/ark/pkg/client-sdk/types"
)

type WalletInfo struct {
	OffchainAddress string `json:"offchain_address"`
	BoardingAddress string `json:"boarding_address"`
}

type SendRequest struct {
	Network string `json:"network"`
	To      string `json:"to"`
	Amount  uint64 `json:"amount"`
}

type BalanceInfo struct {
	OffchainBalance uint64 `json:"offchain_balance"`
	OnchainBalance  uint64 `json:"onchain_balance"`
}

type UTXO struct {
	Amount    uint64 `json:"amount"`
	Locked    bool   `json:"locked"`
	Spendable bool   `json:"spendable"`
}

type FeeEstimate struct {
	TotalFee  uint64 `json:"total_fee"`
	Breakdown struct {
		NetworkFee uint64 `json:"network_fee"`
		ServiceFee uint64 `json:"service_fee"`
	} `json:"breakdown"`
}

var sdkClient arksdk.ArkClient

func main() {
	var err error
	sdkClient, err = setupClient()
	if err != nil {
		log.Fatalf("failed to setup client: %v", err)
	}

	r := mux.NewRouter()
	r.HandleFunc("/wallet/create", createWallet).Methods("POST")
	r.HandleFunc("/payment/send", sendPayment).Methods("POST")
	r.HandleFunc("/payment/estimate", estimateFee).Methods("GET")
	r.HandleFunc("/wallet/utxos", listUTXOs).Methods("GET")
	r.HandleFunc("/wallet/deposit", depositHandler).Methods("POST")
	r.HandleFunc("/wallet/faucet", faucetHandler).Methods("POST")
	r.HandleFunc("/wallet/balance", balanceHandler).Methods("GET")
	r.HandleFunc("/wallet/withdraw", withdrawHandler).Methods("POST")

	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type"}),
	)

	addr := ":8080"
	log.Infof("listening on %s", addr)
	http.ListenAndServe(addr, cors(r))
}

func setupClient() (arksdk.ArkClient, error) {
	base := filepath.Join(common.AppDataDir("ark-wallet", false), "data")
	storeSvc, err := store.NewStore(store.Config{
		ConfigStoreType:  types.FileStore,
		AppDataStoreType: types.KVStore,
		BaseDir:          base,
	})
	if err != nil {
		return nil, fmt.Errorf("store.NewStore: %w", err)
	}

	// Try loading an existing wallet
	client, err := arksdk.LoadCovenantlessClient(storeSvc)
	if err == nil {
		log.Infof("→ Existing wallet detected; unlocking...")
		if unlockErr := client.Unlock(context.Background(), os.Getenv("WALLET_PASSWORD")); unlockErr != nil {
			return nil, fmt.Errorf("client.Unlock: %w", unlockErr)
		}
		return client, nil
	}

	// Otherwise, create a new one
	client, err = arksdk.NewCovenantlessClient(storeSvc)
	if err != nil {
		return nil, fmt.Errorf("NewCovenantlessClient: %w", err)
	}
	args := arksdk.InitArgs{
		WalletType:          arksdk.SingleKeyWallet,
		ClientType:          arksdk.GrpcClient,
		ServerUrl:           os.Getenv("ARK_SERVER_URL"),
		Password:            os.Getenv("WALLET_PASSWORD"),
		WithTransactionFeed: false,
	}
	if initErr := client.Init(context.Background(), args); initErr != nil {
		return nil, fmt.Errorf("client.Init: %w", initErr)
	}
	return client, nil
}

func createWallet(w http.ResponseWriter, _ *http.Request) {
	off, board, err := sdkClient.Receive(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, WalletInfo{OffchainAddress: off, BoardingAddress: board})
}

func estimateFee(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	cfg, err := sdkClient.GetConfigData(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	explSvc := explorer.NewExplorer(cfg.ExplorerURL, cfg.Network)
	feeRate, err := explSvc.GetFeeRate()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	const vbytes = 100.0 // assume 100 vbytes per tx
	total := uint64(feeRate * vbytes)
	est := FeeEstimate{TotalFee: total}
	est.Breakdown.NetworkFee = total * 8 / 10
	est.Breakdown.ServiceFee = total - est.Breakdown.NetworkFee
	jsonResponse(w, est)
}

func listUTXOs(w http.ResponseWriter, _ *http.Request) {
	ctx := context.Background()
	spendable, spent, err := sdkClient.ListVtxos(ctx) // returns (spendable, spent, err) :contentReference[oaicite:2]{index=2}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var out []UTXO
	for _, u := range spendable {
		out = append(out, UTXO{Amount: u.Amount, Locked: false, Spendable: true})
	}
	for _, u := range spent {
		out = append(out, UTXO{Amount: u.Amount, Locked: true, Spendable: false})
	}
	jsonResponse(w, out)
}

func depositHandler(w http.ResponseWriter, _ *http.Request) {
	txid, err := sdkClient.Settle(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"txid": txid})
}

func faucetHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Address string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	out, err := exec.Command("nigiri", "faucet", req.Address).CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("faucet error: %v: %s", err, out), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"message": string(out)})
}

func balanceHandler(w http.ResponseWriter, _ *http.Request) {
	ctx := context.Background()
	spendable, _, err := sdkClient.ListVtxos(ctx) // now correctly 3 returns :contentReference[oaicite:3]{index=3}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var offBal uint64
	for _, u := range spendable {
		offBal += u.Amount
	}
	onchain, err := sdkClient.Balance(ctx, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, BalanceInfo{OffchainBalance: offBal, OnchainBalance: onchain.OnchainBalance.SpendableAmount})
}

func sendPayment(w http.ResponseWriter, r *http.Request) {
	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	var txid string
	var err error
	switch strings.ToLower(req.Network) { // needs import "strings" :contentReference[oaicite:4]{index=4}
	case "ark":
		txid, err = sdkClient.SendOffChain(ctx, false, []arksdk.Receiver{arksdk.NewBitcoinReceiver(req.To, req.Amount)}, true)
	case "onchain":
		txid, err = sdkClient.CollaborativeExit(ctx, req.To, req.Amount, false)
	default:
		http.Error(w, "invalid network", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"txid": txid})
}

func withdrawHandler(w http.ResponseWriter, r *http.Request) {
	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	if _, err := sdkClient.Settle(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	txid, err := sdkClient.CollaborativeExit(ctx, req.To, req.Amount, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"txid": txid})
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}
