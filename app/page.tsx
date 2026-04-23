"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fromRawAmount, pct, usd } from "@/lib/number";
import { holdingPeriods, riskProfiles, type HoldingPeriod, type Position, type PreparedTrade, type RiskProfile, type TokenRecommendation } from "@/lib/types";
import { ClientWalletButton } from "./components/ClientWalletButton";

const usdcMint = process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const usdcDecimals = Number(process.env.NEXT_PUBLIC_CAPITAL_DECIMALS || 6);
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
const dryRun = process.env.NEXT_PUBLIC_DRY_RUN === "true";
const sandboxSigning = process.env.NEXT_PUBLIC_SANDBOX_SIGNING === "true";
const tradeEngine = process.env.NEXT_PUBLIC_TRADE_ENGINE || "jupiter";
const capitalSymbol = process.env.NEXT_PUBLIC_CAPITAL_SYMBOL || "USDC";
const executableSymbol = tradeEngine === "raydium-devnet" ? "TTDG" : "";
const nativeSolMint = "So11111111111111111111111111111111111111112";

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("medium");
  const [allocationPercentage, setAllocationPercentage] = useState(10);
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("1 week");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [recommendations, setRecommendations] = useState<TokenRecommendation[]>([]);
  const [selected, setSelected] = useState<TokenRecommendation | null>(null);
  const [preparedTrade, setPreparedTrade] = useState<PreparedTrade | null>(null);
  const [positions, setPositions] = useState<{ open: Position[]; closed: Position[] }>({ open: [], closed: [] });
  const [positionsLastUpdated, setPositionsLastUpdated] = useState<Date | null>(null);
  const [openedPositionNotice, setOpenedPositionNotice] = useState<{ tokenSymbol: string } | null>(null);
  const [inspectedPosition, setInspectedPosition] = useState<Position | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const owner = publicKey?.toBase58() || "";
  const holdingIndex = Math.max(0, holdingPeriods.indexOf(holdingPeriod));
  const capitalPrecision = capitalSymbol === "SOL" ? 4 : 2;
  const capitalDisplay = connected ? `${usdcBalance.toFixed(capitalPrecision)} ${capitalSymbol}` : "Connect Solflare";
  const investAmount = useMemo(() => {
    const requested = (usdcBalance * allocationPercentage) / 100;
    if (capitalSymbol === "SOL") {
      return Math.max(0, Math.min(requested, usdcBalance - 0.05));
    }
    return requested;
  }, [allocationPercentage, usdcBalance]);
  const investDisplay = `${investAmount.toFixed(capitalPrecision)} ${capitalSymbol}`;
  const activePreparedPosition = preparedTrade
    ? positions.open.find((position) => position.tokenSymbol === preparedTrade.recommendation.tokenSymbol)
    : undefined;
  const openPnL = useMemo(
    () => positions.open.reduce((sum, position) => sum + (position.pnlUsd || 0), 0),
    [positions.open]
  );

  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setUsdcBalance(0);
      return;
    }

    if (usdcMint === nativeSolMint) {
      const lamports = await connection.getBalance(publicKey);
      setUsdcBalance(fromRawAmount(String(lamports), usdcDecimals));
      return;
    }

    const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: new PublicKey(usdcMint)
    });
    const raw = accounts.value.reduce((sum, account) => {
      const amount = account.account.data.parsed.info.tokenAmount.amount as string;
      return sum + BigInt(amount);
    }, 0n);
    setUsdcBalance(fromRawAmount(raw.toString(), usdcDecimals));
  }, [connection, publicKey]);

  const refreshPositions = useCallback(async () => {
    if (!owner) return;
    const response = await fetch(`/api/positions?owner=${owner}`, { cache: "no-store" });
    const payload = await response.json();
    setPositions(payload);
    setPositionsLastUpdated(new Date());
  }, [owner]);

  useEffect(() => {
    refreshBalance().catch(() => setUsdcBalance(0));
  }, [refreshBalance]);

  useEffect(() => {
    refreshPositions().catch(() => undefined);
    const interval = window.setInterval(() => {
      refreshPositions().catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [refreshPositions]);

  useEffect(() => {
    if (!openedPositionNotice) return;

    const timeout = window.setTimeout(() => {
      setOpenedPositionNotice(null);
    }, 3800);

    return () => window.clearTimeout(timeout);
  }, [openedPositionNotice]);

  useEffect(() => {
    if (!inspectedPosition) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInspectedPosition(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inspectedPosition]);

  async function requestRecommendations() {
    setError("");
    setPreparedTrade(null);
    setSelected(null);
    setBusy("recommendations");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: owner,
          usdcBalance,
          riskProfile,
          allocationPercentage,
          holdingPeriod
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Recommendation request failed.");
      setRecommendations(payload.recommendations);
      setSelected(payload.recommendations[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation request failed.");
    } finally {
      setBusy("");
    }
  }

  async function prepareTrade(recommendation: TokenRecommendation) {
    setError("");
    setPreparedTrade(null);
    setBusy("prepare");

    try {
      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          owner,
          amountUsdc: investAmount,
          recommendation
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Trade preparation failed.");
      setPreparedTrade(payload.preparedTrade);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade preparation failed.");
    } finally {
      setBusy("");
    }
  }

  async function executeTrade() {
    if (!preparedTrade) return;
    setError("");
    setBusy("trade");

    try {
      const openedTokenSymbol = preparedTrade.recommendation.tokenSymbol;
      let signature = `dry-run-${crypto.randomUUID()}`;

      if (!dryRun) {
        const transaction = deserializeTransaction(preparedTrade.swapTransaction);
        signature = await signAndSendVersionedTransaction(transaction);
      } else if (sandboxSigning) {
        signature = await sendSandboxSignature(`Token Letal sandbox buy ${preparedTrade.recommendation.tokenSymbol}`);
      }

      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          owner,
          signature,
          preparedTrade
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Position creation failed.");

      setPreparedTrade(null);
      await Promise.all([refreshBalance(), refreshPositions()]);
      setOpenedPositionNotice({ tokenSymbol: openedTokenSymbol });
    } catch (err) {
      setError(describeWalletError(err, "Trade execution failed."));
    } finally {
      setBusy("");
    }
  }

  async function closeNow(position: Position) {
    setError("");
    setBusy(position.id);

    try {
      const prepareResponse = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", owner, positionId: position.id })
      });
      const preparePayload = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(preparePayload.error || "Close preparation failed.");

      let signature = `dry-run-close-${crypto.randomUUID()}`;

      if (!dryRun) {
        const transaction = deserializeTransaction(preparePayload.closeTrade.swapTransaction);
        signature = await signAndSendVersionedTransaction(transaction);
      } else if (sandboxSigning) {
        signature = await sendSandboxSignature(`Token Letal sandbox close ${position.tokenSymbol}`);
      }

      const confirmResponse = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", owner, positionId: position.id, signature })
      });
      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmPayload.error || "Close confirmation failed.");

      await Promise.all([refreshBalance(), refreshPositions()]);
    } catch (err) {
      setError(describeWalletError(err, "Unable to close position."));
    } finally {
      setBusy("");
    }
  }

  async function closeLocal(position: Position) {
    setError("");
    setBusy(position.id);

    try {
      const confirmResponse = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          owner,
          positionId: position.id,
          signature: `local-close-${crypto.randomUUID()}`
        })
      });
      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmPayload.error || "Local close failed.");
      await refreshPositions();
    } catch (err) {
      setError(describeWalletError(err, "Unable to close position locally."));
    } finally {
      setBusy("");
    }
  }

  async function sendSandboxSignature(label: string) {
    if (!publicKey) throw new Error("Connect Solflare first.");

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: publicKey,
        lamports: 0
      })
    );
    transaction.feePayer = publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
    await connection.confirmTransaction(signature, "confirmed");
    console.info(label, signature);
    return signature;
  }

  async function signAndSendVersionedTransaction(transaction: VersionedTransaction) {
    if (!signTransaction) {
      throw new Error("Your wallet does not expose signTransaction. Try reconnecting Solflare.");
    }

    const signed = await signTransaction(transaction);
    const signedSignature = bs58.encode(signed.signatures[0]);

    const existing = await connection.getSignatureStatus(signedSignature, { searchTransactionHistory: true });
    if (existing.value?.confirmationStatus || existing.value?.err === null) {
      return signedSignature;
    }

    const simulation = await connection.simulateTransaction(signed, {
      sigVerify: false,
      replaceRecentBlockhash: false
    });

    if (simulation.value.err) {
      const alreadyProcessed = JSON.stringify(simulation.value.err).toLowerCase().includes("already") || simulation.value.logs?.join("\n").toLowerCase().includes("already");
      if (alreadyProcessed) return signedSignature;

      const logs = simulation.value.logs?.slice(-8).join("\n") || "No simulation logs returned.";
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}\n${logs}`);
    }

    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3
    }).catch((error: Error) => {
      if (error.message.toLowerCase().includes("already been processed")) return signedSignature;
      throw error;
    });
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  }

  return (
    <main className="shell">
      <section className="device">
        <div className="chassis-frame">
          <header className="device-head header-shell panel-shell">
            <div className="brand">
              <span className="brand-kicker">LETAL-01</span>
              <h1>Token Letal</h1>
              <span>The beginner-friendly Solana investment dApp | Powered by La Familia</span>
            </div>
            <div className="wallet-dock">
              <ClientWalletButton />
            </div>
          </header>

          <section className="console-grid">
            <aside className="control-deck panel-shell">
              <div className="screen balance-screen">
                <span>Total {capitalSymbol} Balance</span>
                <strong>{capitalDisplay}</strong>
              </div>
              <div className="screen balance-subscreen">
                <div className="balance-subgrid">
                  <div className="balance-chip">
                    <span>Invested {capitalSymbol}</span>
                    <strong>{investDisplay}</strong>
                  </div>
                  <div className="balance-chip">
                    <span>Open PnL</span>
                    <strong>{formatCapitalValue(openPnL, capitalSymbol, "pnl")}</strong>
                  </div>
                  <div className="balance-chip">
                    <span>Open</span>
                    <strong>{positions.open.length}</strong>
                  </div>
                  <div className="balance-chip">
                    <span>Closed</span>
                    <strong>{positions.closed.length}</strong>
                  </div>
                </div>
              </div>

              <div className="control-module">
                <div className="mini-screen">
                  <span>Risk profile</span>
                  <strong>{riskProfile}</strong>
                </div>
                <div className="risk-slider">
                  {riskProfiles.map((risk, index) => (
                    <button
                      key={risk}
                      className={`risk-dot ${riskProfile === risk ? "active" : ""}`}
                      type="button"
                      aria-label={risk}
                      onClick={() => setRiskProfile(risk)}
                    >
                      <span>{index + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="dial-row">
                <div className="control-module dial-module">
                  <div className="mini-screen">
                    <span>Capital</span>
                    <strong>{allocationPercentage}%</strong>
                  </div>
                  <label className="fader-control">
                    <input
                      aria-label="Wallet capital to invest"
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={allocationPercentage}
                      onChange={(event) => setAllocationPercentage(Number(event.target.value))}
                    />
                    <span className="fader-slot" aria-hidden="true" />
                    <span className="fader-scale capital-scale" aria-hidden="true">
                      <span>5</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </span>
                  </label>
                </div>

                <div className="control-module hold-module">
                  <div className="mini-screen">
                    <span>Holding</span>
                    <strong>{holdingPeriod}</strong>
                  </div>
                  <label className="fader-control">
                    <input
                      aria-label="Expected holding period"
                      type="range"
                      min={0}
                      max={holdingPeriods.length - 1}
                      step={1}
                      value={holdingIndex}
                      onChange={(event) => setHoldingPeriod(holdingPeriods[Number(event.target.value)])}
                    />
                    <span className="fader-slot" aria-hidden="true" />
                    <span className="fader-scale holding-scale" aria-hidden="true">
                      <span>3d</span>
                      <span>1w</span>
                      <span>1m</span>
                      <span>3m</span>
                      <span>6m</span>
                      <span>6m+</span>
                      <span>HODL</span>
                    </span>
                  </label>
                </div>
              </div>

              <button className="key-button" disabled={!connected || busy === "recommendations" || investAmount <= 0} onClick={requestRecommendations}>
                {busy === "recommendations" ? "CALLING NANSEN..." : "GET OPPORTUNITIES"}
              </button>
              <p className="console-note">Invest amount: {investDisplay}. Solflare enabled first.</p>
              {error ? <pre className="error error-screen">{error}</pre> : null}
            </aside>

            <section className="op-shell panel-shell">
              <section className="screen opportunities-screen">
                <div className="screen-title">
                  <h2>{preparedTrade ? "Trade review" : "Nansen opportunities"}</h2>
                  <div className="screen-actions">
                    <span>{preparedTrade ? preparedTrade.recommendation.tokenSymbol : recommendations.length ? "live feed" : "waiting"}</span>
                    <div className="engine-mini-screen">
                      <span>Engine</span>
                      <strong>{tradeEngine === "raydium-devnet" ? "Raydium Devnet" : "Jupiter"}</strong>
                    </div>
                    {preparedTrade ? (
                      <button className="back-button" onClick={() => setPreparedTrade(null)}>Back</button>
                    ) : null}
                  </div>
                </div>
                <div className="opportunity-list">
                  <div className="op-primary">
                    {preparedTrade ? (
                      <>
                        <article className="op-card selected review-selected-card">
                          <div className="op-head">
                            <div className="token-title">
                              <strong>{preparedTrade.recommendation.tokenName} / {preparedTrade.recommendation.tokenSymbol}</strong>
                            </div>
                          </div>
                          <div className="metrics">
                            <Metric label="Confidence" value={`${preparedTrade.recommendation.confidenceScore}/100`} />
                            <Metric label="Risk" value={`${preparedTrade.recommendation.riskScore}/100`} />
                            <Metric label="Upside" value={`${preparedTrade.recommendation.estimatedUpside} / ${formatCapitalValue(preparedTrade.expectedReturnUsd, capitalSymbol, "pnl")}`} />
                            <Metric label="Downside" value={`${preparedTrade.recommendation.estimatedDownside} / ${formatCapitalValue(preparedTrade.expectedLossUsd, capitalSymbol, "pnl")}`} />
                          </div>
                          {tradeEngine === "raydium-devnet" ? (
                            <p className="rationale">Wallet signs a real Raydium devnet CPMM swap transaction into {executableSymbol}. Position is labeled with this Nansen card for UX testing.</p>
                          ) : (
                            <p className="rationale">{dryRun && sandboxSigning ? "Solflare signs a harmless devnet transaction, then a sandbox position is created." : dryRun ? "Sandbox position will be created without wallet trade signing." : "Wallet signs the Jupiter market buy transaction."}</p>
                          )}
                        </article>

                        <div className="embedded-review">
                          <div className="review">
                            <Metric label="Holding period" value={preparedTrade.recommendation.expectedHoldingPeriod} />
                            <Metric label={`${capitalSymbol} amount`} value={`${preparedTrade.amountUsdc.toFixed(capitalPrecision)} ${capitalSymbol}`} />
                            <div className="metric trade-plan-metric">
                              <span>TP / SL / Trail</span>
                              <strong>
                                <b><span>TP</span>{preparedTrade.recommendation.takeProfit}</b>
                                <b><span>SL</span>{preparedTrade.recommendation.stopLoss}</b>
                                <b><span>Trail</span>{preparedTrade.recommendation.trailingStop || "-"}</b>
                              </strong>
                            </div>
                          </div>
                          <p className="rationale">{preparedTrade.recommendation.profileMatch}</p>
                          <button className="trade-now-button" disabled={busy === "trade" || Boolean(activePreparedPosition)} onClick={executeTrade}>
                            {activePreparedPosition ? `Close ${activePreparedPosition.tokenSymbol} first` : busy === "trade" ? "Sending..." : dryRun && sandboxSigning ? "Sign sandbox trade" : dryRun ? "Create sandbox position" : "Trade now"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {recommendations.length === 0 ? <p className="hint">to inniciate connect your wallet, set controls, then press get opportunities.</p> : null}
                        {recommendations.length ? (
                          <div className="op-summary">
                            {tradeEngine === "raydium-devnet" ? (
                              <span>Devnet execution: Raydium SOL to {executableSymbol}. Positions are labeled with the selected Nansen card for UX testing.</span>
                            ) : (
                              <span>Recommendations are ranked from live Nansen Solana signals, then matched to your selected profile.</span>
                            )}
                            <span>Profile: {riskProfile} risk / {holdingPeriod}. Signals include liquidity, activity, holder breadth, and smart-money flow.</span>
                          </div>
                        ) : null}
                        <div className="op-card-grid">
                          {recommendations.map((recommendation) => {
                            const activeRecommendationPosition = positions.open.find((position) => position.tokenSymbol === recommendation.tokenSymbol);

                            return (
                              <article key={recommendation.id} className={`op-card compact-card ${selected?.id === recommendation.id ? "selected" : ""}`}>
                                <div className="op-head">
                                  <div className="token-title">
                                    <strong>{recommendation.tokenName} / {recommendation.tokenSymbol}</strong>
                                  </div>
                                  <button
                                    className="blink-button"
                                    onClick={() => {
                                      setSelected(recommendation);
                                      setPreparedTrade(null);
                                    }}
                                  >
                                    Select
                                  </button>
                                </div>
                                <div className="metrics compact-metrics">
                                  <Metric label="Confidence" value={`${recommendation.confidenceScore}/100`} />
                                  <Metric label="Risk" value={`${recommendation.riskScore}/100`} />
                                  <Metric label="Upside" value={recommendation.estimatedUpside} />
                                  <Metric label="Downside" value={recommendation.estimatedDownside} />
                                </div>
                                {selected?.id === recommendation.id ? (
                                  <button className="review-cta compact-review-cta" disabled={busy === "prepare" || Boolean(activeRecommendationPosition)} onClick={() => prepareTrade(recommendation)}>
                                    {activeRecommendationPosition ? `Active ${recommendation.tokenSymbol} position exists` : busy === "prepare" ? "Preparing swap..." : "Review selected trade"}
                                  </button>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="op-positions-dock">
                    <PositionsPanel
                      positions={positions}
                      positionsLastUpdated={positionsLastUpdated}
                      capitalSymbol={capitalSymbol}
                      busy={busy}
                      onClose={closeNow}
                      onLocalClose={closeLocal}
                      onInspect={setInspectedPosition}
                    />
                  </div>
                </div>
              </section>
            </section>
          </section>

          {cluster !== "mainnet-beta" ? (
            <section className="screen network-warning network-warning-bottom">
              <strong>{dryRun ? "Sandbox mode: no real trade" : "Devnet testing mode"}</strong>
              <p>
                {tradeEngine === "raydium-devnet"
                  ? "Raydium devnet mode signs a real Solflare transaction against a configured Raydium CPMM pool."
                  : dryRun && sandboxSigning
                  ? "The app will call Nansen and ask Solflare to sign a harmless devnet transaction before creating sandbox positions. No token swap is executed."
                  : dryRun
                    ? "The app will call Nansen and create sandbox positions, but it will not request a Jupiter transaction or wallet trade signature."
                  : "Wallet connection, balance reads, Nansen recommendations, review screens, and position UI can be tested here."}
              </p>
            </section>
          ) : null}
        </div>
      </section>

      {openedPositionNotice ? (
        <section
          className="position-opened-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="position-opened-title"
        >
          <article className="position-opened-popup">
            <span className="position-opened-kicker">TRADE CONFIRMED</span>
            <h3 id="position-opened-title">Postion Succesfully Opened</h3>
            <p>
              {openedPositionNotice.tokenSymbol} was added to your open positions.
            </p>
            <button
              className="secondary position-opened-close"
              type="button"
              onClick={() => setOpenedPositionNotice(null)}
            >
              Continue
            </button>
          </article>
        </section>
      ) : null}

      {inspectedPosition ? (
        <section
          className="position-details-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="position-details-title"
          onClick={() => setInspectedPosition(null)}
        >
          <article className="position-details-popup" onClick={(event) => event.stopPropagation()}>
            <div className="position-details-head">
              <div>
                <span className="position-details-kicker">POSITION DETAILS</span>
                <h3 id="position-details-title">
                  {inspectedPosition.tokenName} / {inspectedPosition.tokenSymbol}
                </h3>
              </div>
              <button className="secondary" type="button" onClick={() => setInspectedPosition(null)}>
                Close
              </button>
            </div>

            <div className="position-details-grid">
              <div className="position-details-field"><span>Status</span><strong>{inspectedPosition.status}</strong></div>
              <div className="position-details-field"><span>Engine</span><strong>{inspectedPosition.engine || "n/a"}</strong></div>
              <div className="position-details-field"><span>Entry ({capitalSymbol})</span><strong>{formatCapitalValue(inspectedPosition.entryUsdc, capitalSymbol, "pnl")}</strong></div>
              <div className="position-details-field"><span>Entry Price</span><strong>{formatCapitalValue(inspectedPosition.entryPrice, capitalSymbol, "price")}</strong></div>
              <div className="position-details-field"><span>Current Price</span><strong>{formatCapitalValue(inspectedPosition.currentPrice, capitalSymbol, "price")}</strong></div>
              <div className="position-details-field"><span>Current Value</span><strong>{formatCapitalValue(inspectedPosition.currentValueUsd, capitalSymbol, "pnl")}</strong></div>
              <div className="position-details-field"><span>PnL ({capitalSymbol})</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{formatCapitalValue(inspectedPosition.pnlUsd, capitalSymbol, "pnl")}</strong></div>
              <div className="position-details-field"><span>PnL %</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{pct(inspectedPosition.pnlPercent)}</strong></div>
              <div className="position-details-field"><span>Token Amount (UI)</span><strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(inspectedPosition.tokenAmountUi)}</strong></div>
              <div className="position-details-field"><span>Take Profit</span><strong>{inspectedPosition.takeProfit}</strong></div>
              <div className="position-details-field"><span>Stop Loss</span><strong>{inspectedPosition.stopLoss}</strong></div>
              <div className="position-details-field"><span>Trailing Stop</span><strong>{inspectedPosition.trailingStop || "-"}</strong></div>
              <div className="position-details-field"><span>Holding Period</span><strong>{inspectedPosition.expectedHoldingPeriod}</strong></div>
              <div className="position-details-field"><span>Risk Level</span><strong>{inspectedPosition.riskLevel}</strong></div>
              <div className="position-details-field"><span>Opened At</span><strong>{formatDateTime(inspectedPosition.openedAt)}</strong></div>
              <div className="position-details-field"><span>Closed At</span><strong>{inspectedPosition.closedAt ? formatDateTime(inspectedPosition.closedAt) : "-"}</strong></div>
              <div className="position-details-field position-details-field-wide"><span>Profile Match Rationale</span><strong>{inspectedPosition.recommendationRationale}</strong></div>
            </div>

            <div className="position-details-links">
              <a
                href={buildSolanaExplorerTxUrl(inspectedPosition.openSignature, cluster)}
                target="_blank"
                rel="noreferrer"
              >
                View Open Tx on Explorer
              </a>
              {inspectedPosition.closeSignature ? (
                <a
                  href={buildSolanaExplorerTxUrl(inspectedPosition.closeSignature, cluster)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Close Tx on Explorer
                </a>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PositionsPanel({
  positions,
  positionsLastUpdated,
  capitalSymbol,
  busy,
  onClose,
  onLocalClose,
  onInspect
}: {
  positions: { open: Position[]; closed: Position[] };
  positionsLastUpdated: Date | null;
  capitalSymbol: string;
  busy: string;
  onClose: (position: Position) => void;
  onLocalClose: (position: Position) => void;
  onInspect: (position: Position) => void;
}) {
  const closedPositions = [...positions.closed].sort((a, b) => {
    const aTime = new Date(a.closedAt || a.openedAt).getTime();
    const bTime = new Date(b.closedAt || b.openedAt).getTime();
    return bTime - aTime;
  });

  return (
    <section className="positions-panel">
      <div className="positions-panel-head">
        <h3>Positions</h3>
        <span>
          {positions.open.length} open / {positions.closed.length} closed
          {positionsLastUpdated ? ` - ${positionsLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : " - refresh 60s"}
        </span>
      </div>
      <div className="position-columns">
        <div>
          <h4>Open</h4>
          <div className="position-list compact-position-list open-position-list">
            {positions.open.length === 0 ? <p className="hint">No open positions yet.</p> : null}
            {positions.open.map((position) => (
              <PositionRow
                key={position.id}
                position={position}
                onClose={() => onClose(position)}
                onLocalClose={() => onLocalClose(position)}
                busy={busy === position.id}
                capitalSymbol={capitalSymbol}
                onInspect={() => onInspect(position)}
              />
            ))}
          </div>
        </div>
        <div>
          <h4>Closed</h4>
          <div className="position-list compact-position-list closed-position-list">
            {closedPositions.length === 0 ? <p className="hint">No closed positions yet.</p> : null}
            {closedPositions.map((position) => (
              <PositionRow
                key={position.id}
                position={position}
                onClose={() => undefined}
                busy={false}
                closed
                capitalSymbol={capitalSymbol}
                onInspect={() => onInspect(position)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PositionRow({
  position,
  onClose,
  onLocalClose,
  busy,
  capitalSymbol,
  onInspect,
  closed = false
}: {
  position: Position;
  onClose: () => void;
  onLocalClose?: () => void;
  busy: boolean;
  capitalSymbol: string;
  onInspect: () => void;
  closed?: boolean;
}) {
  const pnlClass = (position.pnlUsd || 0) >= 0 ? "positive" : "negative";
  const valueLabel = capitalSymbol === "SOL" ? "SOL" : "USD";

  return (
    <div
      className="position position-clickable"
      role="button"
      tabIndex={0}
      onClick={onInspect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInspect();
        }
      }}
    >
      <strong>{position.tokenSymbol}<br /><span>{position.status}</span></strong>
      <div><span>Entry {valueLabel}</span><br />{formatCompactCapitalValue(position.entryPrice, capitalSymbol, "price")}</div>
      <div><span>Current {valueLabel}</span><br />{formatCompactCapitalValue(position.currentPrice, capitalSymbol, "price")}</div>
      <div className={pnlClass}><span>PnL {valueLabel}</span><br />{formatCompactCapitalValue(position.pnlUsd, capitalSymbol, "pnl")}</div>
      <div className={pnlClass}><span>PnL %</span><br />{pct(position.pnlPercent)}</div>
      <div><span>TP / SL</span><br />{position.takeProfit} / {position.stopLoss}</div>
      {closed ? (
        <span className="hint">Closed</span>
      ) : (
        <div className="position-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            {busy ? "Closing..." : "Close now"}
          </button>
          {onLocalClose ? (
            <button
              className="secondary subtle"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onLocalClose();
              }}
            >
              Local close
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatCapitalValue(value: number | null | undefined, symbol: string, mode: "price" | "pnl") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";

  if (symbol !== "SOL") {
    return usd(value);
  }

  const abs = Math.abs(value);
  const digits = mode === "price" || abs < 0.01 ? 8 : 4;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);

  return `${formatted} SOL`;
}

function formatCompactCapitalValue(value: number | null | undefined, symbol: string, mode: "price" | "pnl") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (symbol !== "SOL") return usd(value);

  const abs = Math.abs(value);
  const digits = mode === "price" || abs < 0.01 ? 8 : 4;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function buildSolanaExplorerTxUrl(signature: string, clusterName: string) {
  const base = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}`;
  if (clusterName === "mainnet-beta") return base;
  return `${base}?cluster=${encodeURIComponent(clusterName)}`;
}

function deserializeTransaction(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return VersionedTransaction.deserialize(bytes);
}

function describeWalletError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const nested = error as Error & {
    error?: Error & { logs?: string[] };
    logs?: string[];
  };
  const parts = [error.message || error.name || fallback];

  if (nested.error?.message && nested.error.message !== error.message) {
    parts.push(nested.error.message);
  }

  const logs = nested.logs || nested.error?.logs;
  if (logs?.length) {
    parts.push(logs.slice(-8).join("\n"));
  }

  return parts.join("\n");
}
