"use client";

import "./invest.css";
import "./skins/switcher.css";
import "./skins/glass.css";
import "./skins/plush.css";
import "./skins/grid.css";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStellarWallet } from "@/app/providers";
import { pct, usd } from "@/lib/number";
import { suggestedAllocation } from "@/lib/recommendations/scoring";
import { explorerTxUrl, stellarNetwork } from "@/lib/stellar/network";
import { holdingPeriods, type HoldingPeriod, type Position, type PreparedTrade, type RiskProfile, type TokenRecommendation } from "@/lib/types";
import { WalletButton } from "../components/WalletButton";
import { SkinSwitcher, SKINS, useSkin } from "../components/SkinSwitcher";
import OnboardingQuest from "../components/OnboardingQuest";

const PlushBackground = dynamic(() => import("./components/PlushBackground"), { ssr: false });

const dryRun = process.env.NEXT_PUBLIC_DRY_RUN === "true";
const capitalSymbol = "USDC";
const positionsStoragePrefix = "token-letal:positions";

type PositionBuckets = { open: Position[]; closed: Position[] };

export default function Home() {
  const [skin, setSkin] = useSkin();
  const skinEdition = SKINS.find((s) => s.id === skin)?.edition || "METAL-01";
  const [showQuest, setShowQuest] = useState(false);
  const [questCharacter, setQuestCharacter] = useState<string | null>(null);
  const { address, signTransaction } = useStellarWallet();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("medium");
  const [allocationPercentage, setAllocationPercentage] = useState(suggestedAllocation.medium);
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("1 week");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [minLiveTradeUsdc, setMinLiveTradeUsdc] = useState(1);
  const [recommendations, setRecommendations] = useState<TokenRecommendation[]>([]);
  const [selected, setSelected] = useState<TokenRecommendation | null>(null);
  const [preparedTrade, setPreparedTrade] = useState<PreparedTrade | null>(null);
  const [positions, setPositions] = useState<PositionBuckets>(emptyPositionBuckets());
  const [positionsLastUpdated, setPositionsLastUpdated] = useState<Date | null>(null);
  const [openedPositionNotice, setOpenedPositionNotice] = useState<{ tokenSymbol: string } | null>(null);
  const [inspectedPosition, setInspectedPosition] = useState<Position | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const owner = address ?? "";
  const walletConnected = Boolean(owner);
  const positionsStorageKey = owner ? `${positionsStoragePrefix}:${owner}` : "";
  const holdingIndex = Math.max(0, holdingPeriods.indexOf(holdingPeriod));
  const capitalPrecision = 2;
  const capitalDisplay = walletConnected ? `${usdcBalance.toFixed(capitalPrecision)} ${capitalSymbol}` : "Connect wallet";
  const investAmount = useMemo(() => Math.floor(usdcBalance * allocationPercentage) / 100, [allocationPercentage, usdcBalance]);
  const investDisplay = `${investAmount.toFixed(capitalPrecision)} ${capitalSymbol}`;
  const activePreparedPosition = preparedTrade
    ? positions.open.find((position) => position.tokenSymbol === preparedTrade.recommendation.tokenSymbol)
    : undefined;
  const openPnL = useMemo(
    () => positions.open.reduce((sum, position) => sum + (position.pnlUsd || 0), 0),
    [positions.open]
  );
  const belowMinimum = !dryRun && investAmount > 0 && investAmount < minLiveTradeUsdc;
  const canRequestOpportunities = walletConnected && busy !== "recommendations" && investAmount > 0;
  const needsUsdcFunding = walletConnected && investAmount <= 0;
  const fundingBlockerMessage = "Insufficient funds. Add USDC to your account to see today's picks.";
  const minimumMessage = `Purchases need at least ${minLiveTradeUsdc} USDC. Move the capital slider up or add USDC.`;

  const persistPositions = useCallback((next: PositionBuckets) => {
    if (!positionsStorageKey) return;
    try {
      window.localStorage.setItem(positionsStorageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write failures (private mode/quota).
    }
  }, [positionsStorageKey]);

  const commitPositions = useCallback((next: PositionBuckets | ((previous: PositionBuckets) => PositionBuckets)) => {
    setPositions((previous) => {
      const resolved = typeof next === "function"
        ? (next as (previous: PositionBuckets) => PositionBuckets)(previous)
        : next;
      persistPositions(resolved);
      return resolved;
    });
  }, [persistPositions]);

  const refreshBalance = useCallback(async () => {
    if (!owner) {
      setUsdcBalance(0);
      return;
    }

    try {
      const response = await fetch(`/api/wallet/balance?owner=${owner}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Balance API request failed.");
      }

      const payload = (await response.json()) as { balance?: number };
      if (typeof payload.balance === "number" && Number.isFinite(payload.balance)) {
        setUsdcBalance(payload.balance);
        return;
      }

      throw new Error("Balance API returned an invalid value.");
    } catch {
      setUsdcBalance(0);
    }
  }, [owner]);

  const refreshPositions = useCallback(async () => {
    if (!owner) return;
    const response = await fetch(`/api/positions?owner=${owner}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Positions API request failed.");
    }
    const apiPositions = normalizePositionBuckets(payload);
    commitPositions((previous) => mergePositionBuckets(apiPositions, previous));
    setPositionsLastUpdated(new Date());
  }, [owner, commitPositions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("tm:questDone")) setShowQuest(true);
    const character = window.localStorage.getItem("tm:questCharacter");
    if (character) setQuestCharacter(character);
  }, []);

  useEffect(() => {
    fetch("/api/trade/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: { minLiveTradeUsdc?: number }) => {
        if (typeof status.minLiveTradeUsdc === "number") setMinLiveTradeUsdc(status.minLiveTradeUsdc);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!owner || !positionsStorageKey) {
      setPositions(emptyPositionBuckets());
      setPositionsLastUpdated(null);
      return;
    }

    try {
      const stored = window.localStorage.getItem(positionsStorageKey);
      if (!stored) return;
      setPositions(normalizePositionBuckets(JSON.parse(stored)));
    } catch {
      // Ignore corrupt storage and continue with API source.
    }
  }, [owner, positionsStorageKey]);

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

  // Higher risk profiles suggest putting more of the balance to work.
  function chooseRiskProfile(risk: RiskProfile) {
    setRiskProfile(risk);
    setAllocationPercentage(suggestedAllocation[risk]);
  }

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

  async function requestBuyQuote(recommendation: TokenRecommendation, amountUsdc: number) {
    const response = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare", owner, amountUsdc, recommendation })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Trade preparation failed.");
    return payload.preparedTrade as PreparedTrade;
  }

  async function prepareTrade(recommendation: TokenRecommendation) {
    setError("");
    setPreparedTrade(null);
    setBusy("prepare");

    try {
      setPreparedTrade(await requestBuyQuote(recommendation, investAmount));
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
      let trade = preparedTrade;
      let signature = `dry-run-${crypto.randomUUID()}`;

      if (!dryRun) {
        signature = await signAndBroadcast(trade.swapTransaction, async () => {
          trade = await requestBuyQuote(trade.recommendation, trade.amountUsdc);
          return trade.swapTransaction;
        });
      }

      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          owner,
          signature,
          preparedTrade: trade
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Position creation failed.");
      const createdPosition = normalizePosition(payload.position);
      if (createdPosition) {
        commitPositions((previous) => upsertOpenPosition(previous, createdPosition));
      }

      setPreparedTrade(null);
      setOpenedPositionNotice({ tokenSymbol: openedTokenSymbol });
      await Promise.allSettled([refreshBalance(), refreshPositions()]);
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
      const prepareClose = async () => {
        const prepareResponse = await fetch("/api/positions/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "prepare", owner, positionId: position.id })
        });
        const preparePayload = await prepareResponse.json();
        if (!prepareResponse.ok) throw new Error(preparePayload.error || "Close preparation failed.");
        return preparePayload.closeTrade.swapTransaction as string;
      };

      let signature = `dry-run-close-${crypto.randomUUID()}`;
      if (!dryRun) {
        signature = await signAndBroadcast(await prepareClose(), prepareClose);
      }

      const confirmResponse = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", owner, positionId: position.id, signature })
      });
      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmPayload.error || "Close confirmation failed.");
      const closedPosition = normalizePosition(confirmPayload.position);
      if (closedPosition) {
        commitPositions((previous) => upsertClosedPosition(previous, closedPosition));
      }

      await Promise.all([refreshBalance(), refreshPositions()]);
    } catch (err) {
      setError(describeWalletError(err, "Unable to close position."));
    } finally {
      setBusy("");
    }
  }

  // Practice mode only: closes a sandbox position without a transaction.
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
      const closedPosition = normalizePosition(confirmPayload.position);
      if (closedPosition) {
        commitPositions((previous) => upsertClosedPosition(previous, closedPosition));
      }
      await refreshPositions();
    } catch (err) {
      setError(describeWalletError(err, "Unable to close position locally."));
    } finally {
      setBusy("");
    }
  }

  // The wallet signs the server-built Stellar transaction and the server relays
  // it. A transaction that expired before reaching the network is rebuilt and
  // signed once more.
  async function signAndBroadcast(xdr: string, rebuild: () => Promise<string>) {
    let current = xdr;
    for (let attempt = 0; attempt < 2; attempt++) {
      const signedTransaction = await signTransaction(current);
      const response = await fetch("/api/tx/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransaction })
      });
      const payload = await response.json();
      if (response.ok && payload.signature) return payload.signature as string;
      if (payload.code !== "expired" || attempt > 0) throw new Error(payload.error || "Transaction was rejected.");
      current = await rebuild();
    }
    throw new Error("Transaction was rejected.");
  }

  return (
    <>
    {skin === "plush" ? <PlushBackground /> : null}
    <OnboardingQuest
      open={showQuest}
      lang="en"
      skin={skin}
      onComplete={(r) => {
        setShowQuest(false);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tm:questDone", "1");
          if (r) window.localStorage.setItem("tm:questCharacter", r.key);
        }
        if (r) {
          setRiskProfile(r.risk);
          setQuestCharacter(r.key);
        }
      }}
    />
    <main className="shell">
      <section className="device">
        <div className="chassis-frame">
          <header className="device-head header-shell panel-shell">
            <div className="brand">
              <span className="brand-kicker">{skinEdition}</span>
              <div className="brand-logo-wrap">
                <Image
                  className="brand-logo"
                  src="/token-metal-logo-transparent.png"
                  alt="Token-Metal logo"
                  width={866}
                  height={288}
                  priority
                />
                <span className="brand-logo-skin" aria-hidden="true" />
              </div>
              <span>The beginner-friendly Stellar investment app | Powered by La Familia</span>
            </div>
            <div className="wallet-dock">
              <SkinSwitcher skin={skin} onChange={setSkin} />
              <WalletButton />
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
                    <span>Open P/L</span>
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
                  {(["low", "medium", "high"] as const).map((risk) => (
                    <button
                      key={risk}
                      className={`risk-dot ${riskProfile === risk ? "active" : ""}`}
                      type="button"
                      aria-label={risk}
                      onClick={() => chooseRiskProfile(risk)}
                    >
                      <span>{risk.charAt(0).toUpperCase() + risk.slice(1)}</span>
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
                      aria-label="Amount to invest"
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

              <div className={`key-button-wrap ${needsUsdcFunding ? "show-deposit-hint" : ""}`}>
                <button className="key-button" disabled={!canRequestOpportunities} onClick={requestRecommendations}>
                  {busy === "recommendations" ? "READING THE MARKET..." : "GET OPPORTUNITIES"}
                </button>
                {needsUsdcFunding ? (
                  <div className="hover-deposit-modal" role="tooltip" aria-live="polite">
                    <strong>Unable to continue</strong>
                    <p>{fundingBlockerMessage}</p>
                  </div>
                ) : null}
              </div>
              {!walletConnected ? (
                <p className="console-note">Connect your Stellar wallet to see today&apos;s picks.</p>
              ) : needsUsdcFunding ? (
                <p className="console-note">{fundingBlockerMessage}</p>
              ) : belowMinimum ? (
                <p className="console-note">{minimumMessage}</p>
              ) : (
                <p className="console-note">Invest amount: {investDisplay}.</p>
              )}
              {error ? <pre className="error error-screen">{error}</pre> : null}
            </aside>

            <section className="op-shell panel-shell">
              <section className="screen opportunities-screen">
                <div className="screen-title">
                  <h2>{preparedTrade ? "Review your purchase" : "Today's picks"}</h2>
                  <div className="screen-actions">
                    <span>{preparedTrade ? preparedTrade.recommendation.tokenSymbol : recommendations.length ? "live feed" : "waiting"}</span>
                    <div className="engine-mini-screen">
                      <span>Mode</span>
                      <strong>{dryRun ? "Practice" : "Live"}</strong>
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
                          <p className="rationale">
                            {dryRun ? "A practice position will be created without any trade." : "One tap to confirm your purchase in your wallet."}
                          </p>
                        </article>

                        <div className="embedded-review">
                          <div className="review">
                            <Metric label="Holding period" value={preparedTrade.recommendation.expectedHoldingPeriod} />
                            <Metric label={`${capitalSymbol} amount`} value={`${preparedTrade.amountUsdc.toFixed(capitalPrecision)} ${capitalSymbol}`} />
                            {preparedTrade.commissionUsdc ? (
                              <Metric
                                label="Platform fee (2%)"
                                value={`${preparedTrade.commissionUsdc.toFixed(capitalPrecision)} ${capitalSymbol}`}
                              />
                            ) : null}
                            <div className="metric trade-plan-metric">
                              <span>TP / SL</span>
                              <strong>
                                <b><span>TP</span>{preparedTrade.recommendation.takeProfit}</b>
                                <b><span>SL</span>{preparedTrade.recommendation.stopLoss}</b>
                              </strong>
                            </div>
                          </div>
                          <p className="rationale">{preparedTrade.recommendation.profileMatch}</p>
                          <button className="trade-now-button" disabled={busy === "trade" || Boolean(activePreparedPosition)} onClick={executeTrade}>
                            {activePreparedPosition ? `Close ${activePreparedPosition.tokenSymbol} first` : busy === "trade" ? "Confirm in your wallet..." : dryRun ? "Create practice position" : "Trade now"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {recommendations.length === 0 ? <p className="hint">To get started, connect your wallet, set your profile, then press get opportunities.</p> : null}
                        {recommendations.length ? (
                          <div className="op-summary">
                            <span>Picks ranked with live Stellar market data and matched to your profile.</span>
                            <span>Profile: {riskProfile} risk / {holdingPeriod}. Signals include liquidity, trading activity, volatility, trend, and holder breadth.</span>
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
                                  <button className="review-cta compact-review-cta" disabled={busy === "prepare" || Boolean(activeRecommendationPosition) || belowMinimum} onClick={() => prepareTrade(recommendation)}>
                                    {activeRecommendationPosition ? `Active ${recommendation.tokenSymbol} position exists` : belowMinimum ? `Minimum ${minLiveTradeUsdc} USDC` : busy === "prepare" ? "Preparing swap..." : "Review selected trade"}
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
                      onLocalClose={dryRun ? closeLocal : undefined}
                      onInspect={setInspectedPosition}
                    />
                  </div>
                </div>
              </section>
            </section>
          </section>

          {dryRun || stellarNetwork !== "mainnet" ? (
            <section className="screen network-warning network-warning-bottom">
              <strong>{dryRun ? "Practice mode: no real trade" : "Stellar testnet mode"}</strong>
              <p>
                {dryRun
                  ? "The app fetches live picks and creates practice positions. No real trade or wallet confirmation happens."
                  : "Trades run on Stellar testnet. Picks come from mainnet data, so they may have no testnet market."}
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
            <h3 id="position-opened-title">Position Successfully Opened</h3>
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
              <div className="position-details-field"><span>P/L ({capitalSymbol})</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{formatCapitalValue(inspectedPosition.pnlUsd, capitalSymbol, "pnl")}</strong></div>
              <div className="position-details-field"><span>P/L %</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{pct(inspectedPosition.pnlPercent)}</strong></div>
              <div className="position-details-field"><span>Token Amount (UI)</span><strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(inspectedPosition.tokenAmountUi)}</strong></div>
              <div className="position-details-field"><span>Take Profit</span><strong>{inspectedPosition.takeProfit}</strong></div>
              <div className="position-details-field"><span>Stop Loss</span><strong>{inspectedPosition.stopLoss}</strong></div>
              <div className="position-details-field"><span>Holding Period</span><strong>{inspectedPosition.expectedHoldingPeriod}</strong></div>
              <div className="position-details-field"><span>Risk Level</span><strong>{inspectedPosition.riskLevel}</strong></div>
              <div className="position-details-field"><span>Opened At</span><strong>{formatDateTime(inspectedPosition.openedAt)}</strong></div>
              <div className="position-details-field"><span>Closed At</span><strong>{inspectedPosition.closedAt ? formatDateTime(inspectedPosition.closedAt) : "-"}</strong></div>
              <div className="position-details-field position-details-field-wide"><span>Profile Match Rationale</span><strong>{inspectedPosition.recommendationRationale}</strong></div>
            </div>

            <div className="position-details-links">
              <a
                href={explorerTxUrl(inspectedPosition.openSignature)}
                target="_blank"
                rel="noreferrer"
              >
                View Open Tx on Explorer
              </a>
              {inspectedPosition.closeSignature ? (
                <a
                  href={explorerTxUrl(inspectedPosition.closeSignature)}
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
    </>
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
  onLocalClose?: (position: Position) => void;
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
        <div className="positions-panel-head-actions">
          <span>
            {positions.open.length} open / {positions.closed.length} closed
            {positionsLastUpdated ? ` - ${positionsLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : " - refresh 60s"}
          </span>
        </div>
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
                onLocalClose={onLocalClose ? () => onLocalClose(position) : undefined}
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
  const valueLabel = "USD";

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
      <div className={pnlClass}><span>P/L {valueLabel}</span><br />{formatCompactCapitalValue(position.pnlUsd, capitalSymbol, "pnl")}</div>
      <div className={pnlClass}><span>P/L %</span><br />{pct(position.pnlPercent)}</div>
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

function emptyPositionBuckets(): PositionBuckets {
  return { open: [], closed: [] };
}

function normalizePositionBuckets(value: unknown): PositionBuckets {
  const candidate = (value && typeof value === "object") ? value as { open?: unknown; closed?: unknown } : {};
  const open = Array.isArray(candidate.open) ? candidate.open.map(normalizePosition).filter(Boolean) as Position[] : [];
  const closed = Array.isArray(candidate.closed) ? candidate.closed.map(normalizePosition).filter(Boolean) as Position[] : [];
  return mergePositionBuckets({ open, closed }, emptyPositionBuckets());
}

function normalizePosition(value: unknown): Position | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Position>;
  if (!candidate.id || !candidate.owner || !candidate.status || !candidate.tokenSymbol) return null;
  return candidate as Position;
}

function mergePositionBuckets(primary: PositionBuckets, secondary: PositionBuckets): PositionBuckets {
  const open = dedupePositionsById([...primary.open, ...secondary.open]);
  const closed = dedupePositionsById([...primary.closed, ...secondary.closed]);
  const closedIds = new Set(closed.map((position) => position.id));

  return {
    open: open.filter((position) => !closedIds.has(position.id)),
    closed
  };
}

function upsertOpenPosition(previous: PositionBuckets, position: Position): PositionBuckets {
  const open = dedupePositionsById([position, ...previous.open]);
  return {
    open,
    closed: previous.closed.filter((item) => item.id !== position.id)
  };
}

function upsertClosedPosition(previous: PositionBuckets, position: Position): PositionBuckets {
  const closed = dedupePositionsById([position, ...previous.closed]);
  const closedIds = new Set(closed.map((item) => item.id));
  return {
    open: previous.open.filter((item) => !closedIds.has(item.id)),
    closed
  };
}

function dedupePositionsById(positions: Position[]): Position[] {
  const seen = new Set<string>();
  const unique: Position[] = [];

  for (const position of positions) {
    if (!position?.id || seen.has(position.id)) continue;
    seen.add(position.id);
    unique.push(position);
  }

  return unique;
}

function formatCapitalValue(value: number | null | undefined, symbol: string, mode: "price" | "pnl") {
  void symbol;
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (mode === "price" && Math.abs(value) < 0.01) {
    return `$${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(value)}`;
  }
  return usd(value);
}

function formatCompactCapitalValue(value: number | null | undefined, symbol: string, mode: "price" | "pnl") {
  return formatCapitalValue(value, symbol, mode);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

// Wallets reject with Errors or plain objects like { code, message }.
function describeWalletError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return typeof error === "string" ? error : fallback;
}
