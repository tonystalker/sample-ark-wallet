import React, { useState, useEffect } from "react";
import {
  Button,
  Container,
  Header,
  FormField,
  Input,
  Select,
  Tabs,
  Alert,
  Table,
  SpaceBetween,
} from "@cloudscape-design/components";

// Type definitions for wallet and transactions
interface WalletAddresses {
  off: string;
  board: string;
}

interface Balances {
  offchain: number;
  onchain: number;
}

interface Fees {
  total: number;
  breakdown: {
    network: number;
    service: number;
  };
}

interface Utxo {
  amount: number;
  locked: boolean;
  spendable: boolean;
}

interface EstimateFeesResponse extends Fees {}
interface CreateWalletResponse {
  offchain_address: string;
  boarding_address: string;
}
interface SendPaymentResponse {
  txid: string;
}
interface DepositAddressesResponse extends WalletAddresses {}
interface SettleResponse {
  txid: string;
}
interface WithdrawResponse {
  txid: string;
}

// API response shape for balance
interface BalanceResponse {
  offchain_balance: number;
  onchain_balance: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("wallet");
  const [addr, setAddr] = useState<WalletAddresses>({ off: "", board: "" });
  const [error, setError] = useState<string>("");
  const [network, setNetwork] = useState<string>("ark");
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [txid, setTxid] = useState<string>("");
  const [balances, setBalances] = useState<Balances>({
    offchain: 0,
    onchain: 0,
  });
  const [utxos, setUtxos] = useState<Utxo[]>([]);
  const [fees, setFees] = useState<Fees>({
    total: 0,
    breakdown: { network: 0, service: 0 },
  });
  const [utxoWarning, setUtxoWarning] = useState<string>("");

  // Deposit tab state
  const [depositAddr, setDepositAddr] = useState<WalletAddresses>({
    off: "",
    board: "",
  });
  const [settleAmount, setSettleAmount] = useState<string>("");
  const [settleTxid, setSettleTxid] = useState<string>("");

  // Faucet tab state
  const [faucetAddress, setFaucetAddress] = useState<string>("");
  const [faucetMessage, setFaucetMessage] = useState<string>("");

  // Withdraw tab state
  const [withdrawTo, setWithdrawTo] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawTxid, setWithdrawTxid] = useState<string>("");

  useEffect(() => {
    fetchBalances();
    fetchUTXOs();
  }, []);

  // Generic JSON fetch with typed return
  const fetchJSON = async <T = any,>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<T>;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const fetchBalances = async () => {
    try {
      const data = await fetchJSON<BalanceResponse>("/wallet/balance");
      setBalances({
        offchain: data.offchain_balance,
        onchain: data.onchain_balance,
      });
    } catch {}
  };

  const fetchUTXOs = async () => {
    try {
      const data = await fetchJSON<Utxo[]>("/wallet/utxos");
      setUtxos(data);
    } catch {}
  };

  const estimateFees = async () => {
    if (!amount || isNaN(Number(amount))) return;
    try {
      const data = await fetchJSON<EstimateFeesResponse>(
        `/payment/estimate?amount=${amount}&network=${network}`
      );
      setFees(data);
      checkUTXOs(data.total);
    } catch {}
  };

  const checkUTXOs = (required: number) => {
    if (utxos.length === 0) return;
    const largest = Math.max(...utxos.map((u) => u.amount));
    if (largest > required * 10) {
      setUtxoWarning(
        `Large UTXO detected (${largest.toLocaleString()} sats). Consider splitting for better performance.`
      );
    } else {
      setUtxoWarning("");
    }
  };

  const createWallet = async () => {
    try {
      const data = await fetchJSON<CreateWalletResponse>("/wallet/create", {
        method: "POST",
      });
      setAddr({ off: data.offchain_address, board: data.boarding_address });
    } catch {}
  };

  const sendPayment = async () => {
    try {
      const data = await fetchJSON<SendPaymentResponse>("/payment/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, to, amount: Number(amount) }),
      });
      setTxid(data.txid);
      await Promise.all([fetchBalances(), fetchUTXOs()]);
    } catch {}
  };

  const getDepositAddresses = async () => {
    try {
      const data = await fetchJSON<CreateWalletResponse>("/wallet/create", {
        method: "POST",
      });
      setDepositAddr({ off: data.offchain_address, board: data.boarding_address });
    } catch {}
  };

  const settleFunds = async () => {
    try {
      const body = settleAmount ? { amount: Number(settleAmount) } : {};
      const data = await fetchJSON<SettleResponse>("/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSettleTxid(data.txid);
      fetchBalances();
    } catch {}
  };

  const withdrawFunds = async () => {
    try {
      const data = await fetchJSON<WithdrawResponse>("/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: withdrawTo,
          amount: Number(withdrawAmount),
        }),
      });
      setWithdrawTxid(data.txid);
      fetchBalances();
    } catch {}
  };

  const requestFaucet = async () => {
    try {
      const data = await fetchJSON<{ message: string }>("/wallet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: faucetAddress }),
      });
      setFaucetMessage(data.message);
    } catch {}
  };

  return (
    <Container header={<Header variant="h1">ARK Wallet</Header>}>
      <Tabs
        ariaLabel="Main wallet tabs"
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          { id: "wallet", label: "Wallet" },
          { id: "balance", label: "Balance" },
          { id: "send", label: "Send" },
          { id: "utxos", label: "UTXOs" },
          { id: "deposit", label: "Deposit" },
          { id: "faucet", label: "Faucet" },
          { id: "withdraw", label: "Withdraw" },
        ]}
      />

      {error && (
        <Alert type="error" header="Error">
          {error}
        </Alert>
      )}

      {activeTab === "wallet" && (
        <SpaceBetween size="m">
          <Button variant="primary" onClick={createWallet}>
            Generate New Wallet
          </Button>
          {addr.off && (
            <>
              <FormField label="Off-chain Address">
                <Input value={addr.off} readOnly />
              </FormField>
              <FormField label="Boarding Address">
                <Input value={addr.board} readOnly />
              </FormField>
            </>
          )}
        </SpaceBetween>
      )}

      {activeTab === "balance" && (
        <SpaceBetween size="m">
          <Button onClick={fetchBalances}>Refresh Balances</Button>
          <div>
            <h3>
              Off-chain Balance: {(balances.offchain ?? 0).toLocaleString()} sats
            </h3>
            <h3>
              On-chain Balance: {(balances.onchain ?? 0).toLocaleString()} sats
            </h3>
          </div>
        </SpaceBetween>
      )}

      {activeTab === "send" && (
        <SpaceBetween size="m">
          <FormField label="Network">
            <Select
              options={[
                { value: "ark", label: "Off-chain" },
                { value: "onchain", label: "On-chain" },
              ]}
              selectedOption={
                network === "ark"
                  ? { value: "ark", label: "Off-chain" }
                  : { value: "onchain", label: "On-chain" }
              }
              onChange={(e) => {
                setNetwork(e.detail.selectedOption.value ?? "");
                estimateFees();
              }}
            />
          </FormField>

          <FormField label="Recipient Address">
            <Input value={to} onChange={({ detail }) => setTo(detail.value)} />
          </FormField>

          <FormField label="Amount (sats)">
            <Input
              type="number"
              value={amount}
              onChange={({ detail }) => {
                setAmount(detail.value);
                estimateFees();
              }}
            />
          </FormField>

          <FormField label="Fee Estimation">
            <div>
              <p>Total Fee: {fees.total.toLocaleString()} sats</p>
              <p>Network Fee: {fees.breakdown.network.toLocaleString()} sats</p>
              <p>Service Fee: {fees.breakdown.service.toLocaleString()} sats</p>
            </div>
          </FormField>

          {utxoWarning && (
            <Alert type="warning" header="UTXO Optimization">
              {utxoWarning}
            </Alert>
          )}

          <Button variant="primary" onClick={sendPayment}>
            Send Payment
          </Button>

          {txid && (
            <FormField label="Transaction ID">
              <Input value={txid} readOnly />
            </FormField>
          )}
        </SpaceBetween>
      )}

      {activeTab === "utxos" && (
        <SpaceBetween size="m">
          <Button onClick={fetchUTXOs}>Refresh UTXOs</Button>
          <Table
            items={utxos}
            trackBy={(item) => `${item.amount}-${item.locked}-${item.spendable}-${utxos.indexOf(item)}`}
            columnDefinitions={[
              {
                header: "Amount (sats)",
                cell: (item) => item.amount.toLocaleString(),
              },
              {
                header: "Status",
                cell: (item) =>
                  item.locked
                    ? "Locked"
                    : item.spendable
                    ? "Spendable"
                    : "Pending",
              },
            ]}
          />
        </SpaceBetween>
      )}

      {activeTab === "deposit" && (
        <SpaceBetween size="m">
          <Button onClick={getDepositAddresses} variant="primary">
            Get Deposit Addresses
          </Button>
          {depositAddr.off && (
            <>
              <FormField label="Off-chain Deposit Address">
                <Input value={depositAddr.off} readOnly />
              </FormField>
              <FormField label="Boarding Address">
                <Input value={depositAddr.board} readOnly />
              </FormField>

              <FormField
                label="Partial Settlement Amount"
                description="Enter amount in satoshis (leave empty to settle all funds)"
              >
                <Input
                  type="number"
                  value={settleAmount}
                  onChange={({ detail }) => setSettleAmount(detail.value)}
                  placeholder="0"
                />
              </FormField>
              <Button onClick={settleFunds} variant="primary">
                {settleAmount ? "Settle Partial Funds" : "Settle All Funds"}
              </Button>
              {settleTxid && (
                <div className="txid">Settlement TXID: {settleTxid}</div>
              )}
            </>
          )}
        </SpaceBetween>
      )}

      {activeTab === "faucet" && (
        <SpaceBetween size="m">
          <FormField label="Faucet Address">
            <Input
              value={faucetAddress}
              onChange={({ detail }) => setFaucetAddress(detail.value)}
            />
          </FormField>
          <Button onClick={requestFaucet}>Request Test Funds</Button>
          {faucetMessage && (
            <div className="message">{faucetMessage}</div>
          )}
        </SpaceBetween>
      )}

      {activeTab === "withdraw" && (
        <SpaceBetween size="m">
          <FormField label="Withdraw To Address">
            <Input
              value={withdrawTo}
              onChange={({ detail }) => setWithdrawTo(detail.value)}
            />
          </FormField>
          <FormField label="Withdraw Amount (sats)">
            <Input
              type="number"
              value={withdrawAmount}
              onChange={({ detail }) => setWithdrawAmount(detail.value)}
            />
          </FormField>
          <Button onClick={withdrawFunds} variant="primary">
            Withdraw Funds
          </Button>
          {withdrawTxid && (
            <div className="txid">Withdrawal TXID: {withdrawTxid}</div>
          )}
        </SpaceBetween>
      )}
    </Container>
  );
};

export default App;
