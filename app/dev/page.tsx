"use client";

// Bare-bones protocol test bench: connect a Stellar wallet, buy a token with
// USDC through the SDEX engine, then close the position. No design on purpose;
// the real product UI lives elsewhere and calls the same /api routes.

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useStellarWallet } from "@/app/providers";
import { explorerTxUrl } from "@/lib/stellar/network";
import {
  holdingPeriods,
  riskProfiles,
  type HoldingPeriod,
  type Position,
  type PreparedTrade,
  type RiskProfile,
  type TokenRecommendation
} from "@/lib/types";

const MAINNET_PRESETS = [
  { symbol: "XLM", asset: "native" },
  { symbol: "AQUA", asset: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
  { symbol: "yXLM", asset: "yXLM:GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55" },
  { symbol: "SHX", asset: "SHX:GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH" },
  { symbol: "VELO", asset: "VELO:GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M" }
];

interface Balance {
  balance: number;
  activated: boolean;
  hasUsdcTrustline: boolean;
  xlm: number;
  xlmAvailable: number;
}

interface Status {
  sandboxTrading: boolean;
  network: string;
  usdcAsset: string;
  commissionEnabled: boolean;
  minLiveTradeUsdc: number;
}

interface LogLine {
  at: string;
  text: string;
  hash?: string;
}

export default function DevPage() {
  const { address, network, connecting, connect, disconnect, signTransaction } = useStellarWallet();
  const [status, setStatus] = useState<Status | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<{ open: Position[]; closed: Position[] }>({ open: [], closed: [] });
  const [asset, setAsset] = useState(MAINNET_PRESETS[1].asset);
  const [symbol, setSymbol] = useState(MAINNET_PRESETS[1].symbol);
  const [amount, setAmount] = useState("1");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("medium");
  const [allocation, setAllocation] = useState(25);
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("1 month");
  const [recommendations, setRecommendations] = useState<TokenRecommendation[]>([]);
  const [prepared, setPrepared] = useState<PreparedTrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  const say = useCallback((text: string, hash?: string) => {
    setLog((lines) => [{ at: new Date().toLocaleTimeString(), text, hash }, ...lines].slice(0, 40));
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    const [balanceRes, positionsRes] = await Promise.all([
      fetch(`/api/wallet/balance?owner=${address}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/positions?owner=${address}`, { cache: "no-store" }).then((r) => r.json())
    ]);
    setBalance(balanceRes);
    setPositions(positionsRes);
  }, [address]);

  useEffect(() => {
    fetch("/api/trade/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error || "Request failed"), { code: payload.code });
    return payload as T;
  }

  // Signs and broadcasts; when the transaction went stale, rebuilds it once.
  async function signAndSend(xdr: string, rebuild: () => Promise<string>) {
    let current = xdr;
    for (let attempt = 0; attempt < 2; attempt++) {
      say("Waiting for wallet signature…");
      const signedTransaction = await signTransaction(current);
      try {
        const { signature } = await post<{ signature: string }>("/api/tx/broadcast", { signedTransaction });
        say("Transaction confirmed on-chain", signature);
        return signature;
      } catch (error) {
        if ((error as { code?: string }).code !== "expired" || attempt > 0) throw error;
        say("Transaction expired, rebuilding it…");
        current = await rebuild();
      }
    }
    throw new Error("Unreachable");
  }

  async function run(label: string, task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      say(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const investAmount = balance && balance.balance > 0 ? Math.floor(balance.balance * allocation) / 100 : Number(amount);

  const getRecommendations = () =>
    run("Recommendations", async () => {
      setRecommendations([]);
      say(`Asking the engine: ${riskProfile} risk, ${allocation}% (${investAmount} USDC), ${holdingPeriod}…`);
      const { recommendations: picks } = await post<{ recommendations: TokenRecommendation[] }>("/api/recommendations", {
        walletAddress: address ?? undefined,
        usdcBalance: balance && balance.balance > 0 ? balance.balance : Number(amount),
        riskProfile,
        allocationPercentage: balance && balance.balance > 0 ? allocation : 100,
        holdingPeriod
      });
      setRecommendations(picks);
      say(`Got ${picks.length} options: ${picks.map((pick) => pick.tokenSymbol).join(", ")}`);
    });

  const prepareBuy = (recommendation = manualRecommendation(asset, symbol), amountUsdc = Number(amount)) =>
    run("Prepare", async () => {
      if (!address) throw new Error("Connect a wallet first.");
      const { preparedTrade } = await post<{ preparedTrade: PreparedTrade }>("/api/trade", {
        action: "prepare",
        owner: address,
        amountUsdc,
        recommendation
      });
      setPrepared(preparedTrade);
      say(
        `Quote: ${preparedTrade.amountUsdc} USDC -> ~${preparedTrade.expectedTokenAmountUi.toFixed(4)} ${recommendation.tokenSymbol}. Press "Sign & buy".`
      );
    });

  const executeBuy = () =>
    run("Buy", async () => {
      if (!address || !prepared) return;
      let trade = prepared;
      const signature = status?.sandboxTrading
        ? "dry-run"
        : await signAndSend(trade.swapTransaction, async () => {
            const { preparedTrade } = await post<{ preparedTrade: PreparedTrade }>("/api/trade", {
              action: "prepare",
              owner: address,
              amountUsdc: trade.amountUsdc,
              recommendation: trade.recommendation
            });
            trade = preparedTrade;
            return preparedTrade.swapTransaction;
          });
      const { position } = await post<{ position: Position }>("/api/trade", {
        action: "confirm",
        owner: address,
        signature,
        preparedTrade: trade
      });
      setPrepared(null);
      say(`Position opened: ${position.tokenAmountUi.toFixed(4)} ${position.tokenSymbol}`);
    });

  const closePosition = (position: Position) =>
    run("Close", async () => {
      if (!address) return;
      const prepareClose = () =>
        post<{ closeTrade: { swapTransaction: string } }>("/api/positions/close", {
          action: "prepare",
          owner: address,
          positionId: position.id
        });
      const { closeTrade } = await prepareClose();
      const signature = status?.sandboxTrading
        ? "dry-run-close"
        : await signAndSend(closeTrade.swapTransaction, async () => (await prepareClose()).closeTrade.swapTransaction);
      const { position: closed } = await post<{ position: Position }>("/api/positions/close", {
        action: "confirm",
        owner: address,
        positionId: position.id,
        signature
      });
      say(`Closed ${closed.tokenSymbol}: PnL ${closed.pnlUsd?.toFixed(4)} USDC (${closed.pnlPercent?.toFixed(2)}%)`);
    });

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Token Metal · protocol dev bench</h1>
      <p style={styles.muted}>
        Network: <b>{network}</b> · Mode: <b>{status ? (status.sandboxTrading ? "sandbox (dry-run)" : "LIVE") : "…"}</b> ·
        Commission: <b>{status?.commissionEnabled ? "on (0.5%)" : "off"}</b>
      </p>

      <section style={styles.card}>
        <h2 style={styles.heading}>1. Wallet</h2>
        {address ? (
          <>
            <p>
              <code>{address}</code> <button onClick={() => void disconnect()}>Disconnect</button>
            </p>
            {balance && (
              <p>
                USDC: <b>{balance.balance}</b> · XLM: <b>{balance.xlm}</b> (spendable {balance.xlmAvailable.toFixed(2)})
                {!balance.activated && " · account not activated"}
                {balance.activated && !balance.hasUsdcTrustline && " · no USDC trustline"}
              </p>
            )}
          </>
        ) : (
          <button disabled={connecting} onClick={() => void connect()}>
            {connecting ? "Connecting…" : "Connect Stellar wallet"}
          </button>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>2. Your three inputs</h2>
        <div style={styles.row}>
          <label>
            Risk profile{" "}
            <select value={riskProfile} onChange={(e) => setRiskProfile(e.target.value as RiskProfile)}>
              {riskProfiles.map((profile) => (
                <option key={profile}>{profile}</option>
              ))}
            </select>
          </label>
          <label>
            Invest {allocation}% of USDC{" "}
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={allocation}
              onChange={(e) => setAllocation(Number(e.target.value))}
            />
          </label>
          <label>
            Money back in{" "}
            <select value={holdingPeriod} onChange={(e) => setHoldingPeriod(e.target.value as HoldingPeriod)}>
              {holdingPeriods.map((period) => (
                <option key={period}>{period}</option>
              ))}
            </select>
          </label>
        </div>
        <p style={styles.muted}>
          Amount to invest: <b>{investAmount} USDC</b>
          {!(balance && balance.balance > 0) && " (no USDC balance; using the USDC field below)"}
        </p>
        <button disabled={busy} onClick={getRecommendations}>
          Get 3 recommendations
        </button>
        <div style={styles.options}>
          {recommendations.map((recommendation, index) => (
            <div key={recommendation.id} style={styles.option}>
              <div style={styles.row}>
                <b style={{ fontSize: 18 }}>
                  #{index + 1} {recommendation.tokenSymbol}
                </b>
                <span style={styles.muted}>{recommendation.tokenName}</span>
              </div>
              <p style={styles.muted}>
                Risk {recommendation.riskScore}/100 · Confidence {recommendation.confidenceScore}/100
              </p>
              <p>
                Take profit <b>{recommendation.takeProfit}</b> · Stop loss <b>{recommendation.stopLoss}</b>
                {recommendation.trailingStop && <> · Trailing {recommendation.trailingStop}</>}
              </p>
              <p style={styles.small}>{recommendation.entryRationale}</p>
              <p style={styles.small}>{recommendation.profileMatch}</p>
              <button disabled={busy} onClick={() => prepareBuy(recommendation, investAmount)}>
                Invest {investAmount} USDC in {recommendation.tokenSymbol}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>3. Buy (or pick a token manually)</h2>
        <div style={styles.row}>
          {MAINNET_PRESETS.map((preset) => (
            <button
              key={preset.asset}
              style={preset.asset === asset ? styles.active : undefined}
              onClick={() => {
                setAsset(preset.asset);
                setSymbol(preset.symbol);
                setPrepared(null);
              }}
            >
              {preset.symbol}
            </button>
          ))}
        </div>
        <div style={styles.row}>
          <label>
            Asset <input style={{ width: 520 }} value={asset} onChange={(e) => setAsset(e.target.value)} />
          </label>
          <label>
            Symbol <input style={{ width: 80 }} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </label>
          <label>
            USDC <input style={{ width: 80 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        <div style={styles.row}>
          <button disabled={busy || !address} onClick={() => prepareBuy()}>
            Prepare manual quote
          </button>
          <button disabled={busy || !prepared} onClick={executeBuy}>
            Sign &amp; buy
          </button>
        </div>
        {prepared && <pre style={styles.pre}>{JSON.stringify(prepared.quoteResponse, null, 2)}</pre>}
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>4. Positions</h2>
        {positions.open.length === 0 && <p style={styles.muted}>No open positions.</p>}
        {positions.open.map((position) => (
          <div key={position.id} style={styles.row}>
            <span>
              <b>{position.tokenSymbol}</b> {position.tokenAmountUi.toFixed(4)} · entry {position.entryUsdc} USDC · now{" "}
              {position.currentValueUsd?.toFixed(4) ?? "-"} · PnL {position.pnlPercent?.toFixed(2) ?? "-"}%
            </span>
            <button disabled={busy} onClick={() => closePosition(position)}>
              Close
            </button>
          </div>
        ))}
        {positions.closed.length > 0 && (
          <details>
            <summary>{positions.closed.length} closed</summary>
            {positions.closed.map((position) => (
              <p key={position.id} style={styles.muted}>
                {position.tokenSymbol} · entry {position.entryUsdc} → exit {position.currentValueUsd?.toFixed(4)} · PnL{" "}
                {position.pnlUsd?.toFixed(4)} USDC
              </p>
            ))}
          </details>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>Log</h2>
        {log.map((line, index) => (
          <div key={index} style={styles.muted}>
            {line.at} · {line.text}{" "}
            {line.hash && (
              <a href={explorerTxUrl(line.hash)} target="_blank" rel="noreferrer">
                view tx
              </a>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}

function manualRecommendation(asset: string, symbol: string): TokenRecommendation {
  return {
    id: `manual-${asset}`,
    tokenName: symbol,
    tokenSymbol: symbol,
    mintAddress: asset,
    confidenceScore: 0,
    riskScore: 50,
    expectedHoldingPeriod: "1 week",
    entryRationale: "Manual test trade from /dev",
    takeProfit: "+10%",
    stopLoss: "-10%",
    estimatedUpside: "+10%",
    estimatedDownside: "-10%",
    profileMatch: "Manual test trade",
    nansenSource: "manual /dev"
  };
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "ui-monospace, monospace", color: "#eee", background: "#111", minHeight: "100vh" },
  card: { border: "1px solid #333", borderRadius: 8, padding: 16, marginBottom: 16 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  heading: { color: "#c6ff00", fontSize: 18, margin: "0 0 12px" },
  muted: { color: "#aaa", fontSize: 13 },
  small: { color: "#ccc", fontSize: 12, lineHeight: 1.5 },
  options: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 },
  option: { border: "1px solid #c6ff00", borderRadius: 8, padding: 12 },
  active: { outline: "2px solid #c6ff00" },
  pre: { background: "#000", padding: 12, overflowX: "auto", fontSize: 12 }
};
