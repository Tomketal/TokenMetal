"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction as usePrivySignAndSendTransaction, useWallets as usePrivySolanaWallets, type ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import Image from "next/image";
import bs58 from "bs58";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pct, usd } from "@/lib/number";
import { holdingPeriods, riskProfiles, type HoldingPeriod, type Position, type PreparedTrade, type RiskProfile, type TokenRecommendation } from "@/lib/types";
import { PrivyLoginButton } from "./components/PrivyLoginButton";

const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
const dryRun = process.env.NEXT_PUBLIC_DRY_RUN === "true";
const sandboxSigning = process.env.NEXT_PUBLIC_SANDBOX_SIGNING === "true";
const tradeEngine = process.env.NEXT_PUBLIC_TRADE_ENGINE || "jupiter";
const capitalSymbol = process.env.NEXT_PUBLIC_CAPITAL_SYMBOL || "USDC";
const executableSymbol = tradeEngine === "raydium-devnet" ? "TTDG" : "";
const positionsStoragePrefix = "token-letal:positions";

type PositionBuckets = { open: Position[]; closed: Position[] };
type TriggerAuthChallenge =
  | {
    type: "message";
    challenge: string;
  }
  | {
    type: "transaction";
    transaction: string;
  };

function resolvePrivySolanaChain(value: string): "solana:mainnet" | "solana:devnet" | "solana:testnet" {
  if (value === "devnet") return "solana:devnet";
  if (value === "testnet") return "solana:testnet";
  return "solana:mainnet";
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, signMessage } = useWallet();
  const { ready: privyReady, authenticated: privyAuthenticated, user: privyUser } = usePrivy();
  const { wallets: privySolanaWallets } = usePrivySolanaWallets();
  const { signAndSendTransaction: privySignAndSendTransaction } = usePrivySignAndSendTransaction();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("medium");
  const [allocationPercentage, setAllocationPercentage] = useState(10);
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("1 week");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [recommendations, setRecommendations] = useState<TokenRecommendation[]>([]);
  const [selected, setSelected] = useState<TokenRecommendation | null>(null);
  const [preparedTrade, setPreparedTrade] = useState<PreparedTrade | null>(null);
  const [positions, setPositions] = useState<PositionBuckets>(emptyPositionBuckets());
  const [positionsLastUpdated, setPositionsLastUpdated] = useState<Date | null>(null);
  const [openedPositionNotice, setOpenedPositionNotice] = useState<{ tokenSymbol: string } | null>(null);
  const [inspectedPosition, setInspectedPosition] = useState<Position | null>(null);
  const [triggerAuthTokens, setTriggerAuthTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [armingAll, setArmingAll] = useState(false);
  const [error, setError] = useState("");

  const walletAdapterOwner = publicKey?.toBase58() || "";
  const privyConnectedSolanaWallet = useMemo<ConnectedStandardSolanaWallet | null>(() => {
    if (!Array.isArray(privySolanaWallets) || privySolanaWallets.length === 0) return null;
    return privySolanaWallets[0] || null;
  }, [privySolanaWallets]);
  const privyConnectedOwner = privyConnectedSolanaWallet?.address || "";
  const privyLinkedOwner = useMemo(() => {
    if (!privyUser) return "";
    if (privyUser.wallet?.chainType === "solana" && privyUser.wallet.address) {
      return privyUser.wallet.address;
    }
    for (const account of privyUser.linkedAccounts) {
      if (account.type === "wallet" && account.chainType === "solana") {
        return account.address;
      }
    }
    return "";
  }, [privyUser]);
  const privySessionActive = privyReady && privyAuthenticated;
  const privySessionOwner = privySessionActive ? (privyConnectedOwner || privyLinkedOwner) : "";
  const owner = walletAdapterOwner || privySessionOwner;
  const walletConnected = Boolean(walletAdapterOwner || privySessionOwner);
  const signedInWithoutWallet = privySessionActive && !walletConnected;
  const positionsStorageKey = owner ? `${positionsStoragePrefix}:${owner}` : "";
  const holdingIndex = Math.max(0, holdingPeriods.indexOf(holdingPeriod));
  const capitalPrecision = capitalSymbol === "SOL" ? 4 : 2;
  const capitalDisplay = walletConnected ? `${usdcBalance.toFixed(capitalPrecision)} ${capitalSymbol}` : "Connect Wallet";
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
  const canRequestOpportunities = walletConnected && busy !== "recommendations" && investAmount > 0;
  const needsUsdcFunding = walletConnected && capitalSymbol === "USDC" && investAmount <= 0;
  const fundingBlockerMessage = "Insufficient funds. Deposit USDC to your wallet to get opportunities, and keep a small SOL balance for network fees.";

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
    if (!owner || !positionsStorageKey) {
      setPositions(emptyPositionBuckets());
      setPositionsLastUpdated(null);
      setTriggerAuthTokens({});
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
        signature = await sendSandboxSignature(`Token-Metal sandbox buy ${preparedTrade.recommendation.tokenSymbol}`);
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
      if (position.triggerOrder) {
        throw new Error("Cancel the active TP/SL order before closing this position manually.");
      }

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
        signature = await sendSandboxSignature(`Token-Metal sandbox close ${position.tokenSymbol}`);
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

  async function closeLocal(position: Position) {
    setError("");
    setBusy(position.id);

    try {
      if (position.triggerOrder) {
        throw new Error("Cancel the active TP/SL order before using local close.");
      }

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

  async function armTriggerOrder(
    position: Position,
    options?: {
      refreshAfter?: boolean;
      suppressErrorReset?: boolean;
      suppressErrorReport?: boolean;
    }
  ): Promise<boolean> {
    if (!options?.suppressErrorReset) {
      setError("");
    }
    setBusy(`arm:${position.id}`);

    try {
      if (tradeEngine !== "jupiter") {
        throw new Error("TP/SL trigger orders are currently supported only on the Jupiter engine.");
      }

      const challengeType = resolveTriggerChallengeType();
      const challengeResponse = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "challenge",
          owner,
          challengeType
        })
      });
      const challengePayload = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challengePayload.error || "Unable to start trigger auth.");
      const challenge = challengePayload.challenge as TriggerAuthChallenge;

      const proof = await signTriggerAuthChallenge(challenge);

      const craftResponse = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "craft",
          owner,
          positionId: position.id,
          proof
        })
      });
      const craftPayload = await craftResponse.json();
      if (!craftResponse.ok) throw new Error(craftPayload.error || "Unable to craft trigger deposit.");

      const signedDepositTx = await signVersionedTransactionToBase64(
        deserializeTransaction(craftPayload.deposit.transaction as string)
      );

      const confirmResponse = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          owner,
          positionId: position.id,
          authToken: craftPayload.authToken,
          depositRequestId: craftPayload.deposit.requestId,
          depositSignedTx: signedDepositTx
        })
      });
      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmPayload.error || "Unable to create TP/SL trigger order.");

      const updated = normalizePosition(confirmPayload.position);
      if (updated) {
        commitPositions((previous) => upsertOpenPosition(previous, updated));
      }

      setTriggerAuthTokens((previous) => ({ ...previous, [position.id]: craftPayload.authToken as string }));
      if (options?.refreshAfter ?? true) {
        await refreshPositions();
      }
      return true;
    } catch (err) {
      if (!options?.suppressErrorReport) {
        setError(describeWalletError(err, "Unable to arm TP/SL order."));
      }
      return false;
    } finally {
      setBusy("");
    }
  }

  async function armAllTriggerOrders() {
    if (armingAll) return;
    setError("");

    if (tradeEngine !== "jupiter") {
      setError("TP/SL trigger orders are currently supported only on the Jupiter engine.");
      return;
    }

    const openWithoutTrigger = positions.open.filter((position) => position.status === "open" && !position.triggerOrder);
    if (openWithoutTrigger.length === 0) {
      setError("No open positions without TP/SL orders.");
      return;
    }

    setArmingAll(true);

    let armed = 0;
    const failed: string[] = [];

    try {
      for (const position of openWithoutTrigger) {
        const success = await armTriggerOrder(position, {
          refreshAfter: false,
          suppressErrorReset: true,
          suppressErrorReport: true
        });
        if (success) {
          armed += 1;
        } else {
          failed.push(position.tokenSymbol);
        }
      }

      await refreshPositions();

      if (failed.length > 0) {
        const successPrefix = armed > 0 ? `${armed} armed. ` : "";
        setError(`${successPrefix}Failed to arm TP/SL for: ${failed.join(", ")}.`);
      }
    } finally {
      setArmingAll(false);
    }
  }

  async function syncTriggerOrder(position: Position) {
    setError("");
    setBusy(`sync:${position.id}`);

    try {
      const authToken = await getTriggerAuthTokenForPosition(position.id);

      const response = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          owner,
          positionId: position.id,
          authToken
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sync trigger order state.");

      const updated = normalizePosition(payload.position);
      if (updated) {
        commitPositions((previous) => upsertOpenPosition(previous, updated));
      }
    } catch (err) {
      setError(describeWalletError(err, "Unable to sync TP/SL status."));
    } finally {
      setBusy("");
    }
  }

  async function cancelTriggerOrder(position: Position) {
    setError("");
    setBusy(`cancel:${position.id}`);

    try {
      const authToken = await getTriggerAuthTokenForPosition(position.id);

      const cancelCraftResponse = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancelCraft",
          owner,
          positionId: position.id,
          authToken
        })
      });
      const cancelCraftPayload = await cancelCraftResponse.json();
      if (!cancelCraftResponse.ok) throw new Error(cancelCraftPayload.error || "Unable to start TP/SL cancellation.");

      const cancelSignedTx = await signVersionedTransactionToBase64(
        deserializeTransaction(cancelCraftPayload.cancellation.transaction as string)
      );

      const cancelConfirmResponse = await fetch("/api/trigger/oco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancelConfirm",
          owner,
          positionId: position.id,
          authToken,
          cancelRequestId: cancelCraftPayload.cancellation.requestId,
          cancelSignedTx
        })
      });
      const cancelConfirmPayload = await cancelConfirmResponse.json();
      if (!cancelConfirmResponse.ok) throw new Error(cancelConfirmPayload.error || "Unable to confirm TP/SL cancellation.");

      const updated = normalizePosition(cancelConfirmPayload.position);
      if (updated) {
        commitPositions((previous) => upsertOpenPosition(previous, updated));
      }

      setTriggerAuthTokens((previous) => {
        const next = { ...previous };
        delete next[position.id];
        return next;
      });

      await refreshPositions();
    } catch (err) {
      setError(describeWalletError(err, "Unable to cancel TP/SL order."));
    } finally {
      setBusy("");
    }
  }

  async function getTriggerAuthTokenForPosition(positionId: string) {
    const cached = triggerAuthTokens[positionId];
    if (cached) return cached;

    const challengeType = resolveTriggerChallengeType();
    const challengeResponse = await fetch("/api/trigger/oco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "challenge",
        owner,
        challengeType
      })
    });
    const challengePayload = await challengeResponse.json();
    if (!challengeResponse.ok) throw new Error(challengePayload.error || "Unable to start trigger auth.");

    const proof = await signTriggerAuthChallenge(challengePayload.challenge as TriggerAuthChallenge);

    const authResponse = await fetch("/api/trigger/oco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "authenticate",
        owner,
        proof
      })
    });
    const authPayload = await authResponse.json();
    if (!authResponse.ok) throw new Error(authPayload.error || "Unable to authenticate trigger session.");

    const token = authPayload.authToken as string;
    setTriggerAuthTokens((previous) => ({ ...previous, [positionId]: token }));
    return token;
  }

  function resolveTriggerChallengeType(): "message" | "transaction" {
    if ((publicKey && signMessage) || privyConnectedSolanaWallet) {
      return "message";
    }
    return "transaction";
  }

  async function signTriggerAuthChallenge(challenge: TriggerAuthChallenge) {
    if (challenge.type === "message") {
      const messageBytes = new TextEncoder().encode(challenge.challenge);

      if (publicKey && signMessage) {
        const signature = await signMessage(messageBytes);
        return {
          type: "message" as const,
          signature: bs58.encode(signature)
        };
      }

      if (privyConnectedSolanaWallet) {
        const signed = await privyConnectedSolanaWallet.signMessage({
          message: messageBytes
        });
        return {
          type: "message" as const,
          signature: bs58.encode(signed.signature)
        };
      }

      throw new Error("The connected wallet does not support message signing for trigger auth.");
    }

    const signedTransaction = await signVersionedTransactionToBase64(
      deserializeTransaction(challenge.transaction)
    );

    return {
      type: "transaction" as const,
      signedTransaction
    };
  }

  async function signVersionedTransactionToBase64(transaction: VersionedTransaction) {
    if (publicKey && signTransaction) {
      const signed = await signTransaction(transaction);
      return bytesToBase64(signed.serialize());
    }

    if (privyConnectedSolanaWallet) {
      const signed = await privyConnectedSolanaWallet.signTransaction({
        transaction: transaction.serialize(),
        chain: resolvePrivySolanaChain(cluster)
      });
      return bytesToBase64(signed.signedTransaction);
    }

    throw new Error("Connect a Solana wallet that can sign transactions.");
  }

  async function sendSandboxSignature(label: string) {
    if (!owner) throw new Error("Log in and connect a Solana wallet first.");

    const ownerPubkey = new PublicKey(owner);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: ownerPubkey,
        toPubkey: ownerPubkey,
        lamports: 0
      })
    );
    transaction.feePayer = ownerPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    if (publicKey) {
      const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
      await waitForSignatureConfirmationHttp(connection, signature);
      console.info(label, signature);
      return signature;
    }

    if (!privyConnectedSolanaWallet) {
      throw new Error("Connect Solflare, Phantom, or Backpack in Privy first.");
    }

    const unsignedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    const signed = await privySignAndSendTransaction({
      transaction: unsignedTransaction,
      wallet: privyConnectedSolanaWallet,
      chain: resolvePrivySolanaChain(cluster)
    });
    const signature = bs58.encode(signed.signature);
    await waitForSignatureConfirmationHttp(connection, signature);
    console.info(label, signature);
    return signature;
  }

  async function signAndSendVersionedTransaction(transaction: VersionedTransaction) {
    if (!publicKey && privyConnectedSolanaWallet) {
      const signed = await privySignAndSendTransaction({
        transaction: transaction.serialize(),
        wallet: privyConnectedSolanaWallet,
        chain: resolvePrivySolanaChain(cluster),
        options: { skipPreflight: true, maxRetries: 3 }
      });
      const signature = bs58.encode(signed.signature);
      await waitForSignatureConfirmationHttp(connection, signature);
      return signature;
    }

    // Prefer wallet-native broadcast path first. Some public RPCs reject direct sendRawTransaction with 403.
    try {
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
        maxRetries: 3
      });
      await waitForSignatureConfirmationHttp(connection, signature);
      return signature;
    } catch (walletBroadcastError) {
      if (isUserRejectedError(walletBroadcastError)) {
        throw walletBroadcastError;
      }

      if (!signTransaction) {
        throw walletBroadcastError;
      }

      const signed = await signTransaction(transaction);
      const signedSignature = bs58.encode(signed.signatures[0]);
      const serialized = signed.serialize();

      try {
        const signature = await connection.sendRawTransaction(serialized, {
          skipPreflight: true,
          maxRetries: 3
        }).catch((error: Error) => {
          if (error.message.toLowerCase().includes("already been processed")) return signedSignature;
          throw error;
        });
        await waitForSignatureConfirmationHttp(connection, signature);
        return signature;
      } catch (rpcBroadcastError) {
        if (isAccessForbiddenError(walletBroadcastError) || isAccessForbiddenError(rpcBroadcastError)) {
          try {
            const relayResponse = await fetch("/api/tx/broadcast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                signedTransaction: bytesToBase64(serialized)
              })
            });
            const relayPayload = await relayResponse.json();
            if (!relayResponse.ok || !relayPayload.signature) {
              throw new Error(relayPayload.error || "Relay broadcast failed.");
            }
            return relayPayload.signature as string;
          } catch (relayError) {
            throw new Error(
              [
                "RPC rejected transaction broadcast with 403 Access forbidden.",
                relayError instanceof Error ? relayError.message : "Relay broadcast failed.",
                "Use a write-enabled mainnet RPC in NEXT_PUBLIC_SOLANA_RPC_URL and restart the app."
              ].join(" ")
            );
          }
        }
        throw rpcBroadcastError;
      }
    }
  }

  return (
    <main className="shell">
      <section className="device">
        <div className="chassis-frame">
          <header className="device-head header-shell panel-shell">
            <div className="brand">
              <span className="brand-kicker">METAL-01</span>
              <div className="brand-logo-wrap">
                <Image
                  className="brand-logo"
                  src="/token-metal-logo-transparent.png"
                  alt="Token-Metal logo"
                  width={866}
                  height={288}
                  priority
                />
              </div>
              <span>The beginner-friendly Solana investment dApp | Powered by La Familia</span>
            </div>
            <div className="wallet-dock">
              <PrivyLoginButton />
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

              <div className={`key-button-wrap ${needsUsdcFunding ? "show-deposit-hint" : ""}`}>
                <button className="key-button" disabled={!canRequestOpportunities} onClick={requestRecommendations}>
                  {busy === "recommendations" ? "CALLING NANSEN..." : "GET OPPORTUNITIES"}
                </button>
                {needsUsdcFunding ? (
                  <div className="hover-deposit-modal" role="tooltip" aria-live="polite">
                    <strong>Unable to continue</strong>
                    <p>{fundingBlockerMessage}</p>
                  </div>
                ) : null}
              </div>
              {!walletConnected ? (
                <p className="console-note">
                  {signedInWithoutWallet
                    ? "Signed in. Link a Solana wallet in Privy to load your balance."
                    : "Log in and connect Solflare or Phantom to unlock opportunities."}
                </p>
              ) : needsUsdcFunding ? (
                <p className="console-note">{fundingBlockerMessage}</p>
              ) : (
                <p className="console-note">Invest amount: {investDisplay}.</p>
              )}
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
                            {preparedTrade.commissionUsdc ? (
                              <Metric
                                label="Platform fee (0.5%)"
                                value={`${preparedTrade.commissionUsdc.toFixed(capitalPrecision)} ${capitalSymbol}`}
                              />
                            ) : null}
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
                      armingAll={armingAll}
                      onClose={closeNow}
                      onLocalClose={closeLocal}
                      onArmTrigger={armTriggerOrder}
                      onArmAllTrigger={armAllTriggerOrders}
                      onSyncTrigger={syncTriggerOrder}
                      onCancelTrigger={cancelTriggerOrder}
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
              <div className="position-details-field"><span>PnL ({capitalSymbol})</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{formatCapitalValue(inspectedPosition.pnlUsd, capitalSymbol, "pnl")}</strong></div>
              <div className="position-details-field"><span>PnL %</span><strong className={(inspectedPosition.pnlUsd || 0) >= 0 ? "positive" : "negative"}>{pct(inspectedPosition.pnlPercent)}</strong></div>
              <div className="position-details-field"><span>Token Amount (UI)</span><strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(inspectedPosition.tokenAmountUi)}</strong></div>
              <div className="position-details-field"><span>Take Profit</span><strong>{inspectedPosition.takeProfit}</strong></div>
              <div className="position-details-field"><span>Stop Loss</span><strong>{inspectedPosition.stopLoss}</strong></div>
              <div className="position-details-field"><span>Trailing Stop</span><strong>{inspectedPosition.trailingStop || "-"}</strong></div>
              <div className="position-details-field"><span>Trigger State</span><strong>{inspectedPosition.triggerOrder?.orderState || "not armed"}</strong></div>
              <div className="position-details-field"><span>Trigger Order ID</span><strong>{inspectedPosition.triggerOrder?.orderId || "-"}</strong></div>
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
  armingAll,
  onClose,
  onLocalClose,
  onArmTrigger,
  onArmAllTrigger,
  onSyncTrigger,
  onCancelTrigger,
  onInspect
}: {
  positions: { open: Position[]; closed: Position[] };
  positionsLastUpdated: Date | null;
  capitalSymbol: string;
  busy: string;
  armingAll: boolean;
  onClose: (position: Position) => void;
  onLocalClose: (position: Position) => void;
  onArmTrigger: (position: Position) => Promise<boolean>;
  onArmAllTrigger: () => void;
  onSyncTrigger: (position: Position) => void;
  onCancelTrigger: (position: Position) => void;
  onInspect: (position: Position) => void;
}) {
  const openWithoutTriggerCount = positions.open.filter((position) => !position.triggerOrder).length;
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
          <button
            className="secondary subtle arm-all-button"
            type="button"
            disabled={armingAll || openWithoutTriggerCount === 0}
            onClick={onArmAllTrigger}
          >
            {armingAll ? "Arming all..." : "Arm TP/SL All"}
          </button>
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
                onLocalClose={() => onLocalClose(position)}
                globalBusy={armingAll}
                busy={busy === position.id}
                arming={busy === `arm:${position.id}`}
                syncingTrigger={busy === `sync:${position.id}`}
                cancellingTrigger={busy === `cancel:${position.id}`}
                onArmTrigger={() => onArmTrigger(position)}
                onSyncTrigger={() => onSyncTrigger(position)}
                onCancelTrigger={() => onCancelTrigger(position)}
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
                globalBusy={false}
                busy={false}
                arming={false}
                syncingTrigger={false}
                cancellingTrigger={false}
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
  globalBusy,
  busy,
  arming,
  syncingTrigger,
  cancellingTrigger,
  onArmTrigger,
  onSyncTrigger,
  onCancelTrigger,
  capitalSymbol,
  onInspect,
  closed = false
}: {
  position: Position;
  onClose: () => void;
  onLocalClose?: () => void;
  globalBusy: boolean;
  busy: boolean;
  arming: boolean;
  syncingTrigger: boolean;
  cancellingTrigger: boolean;
  onArmTrigger?: () => void;
  onSyncTrigger?: () => void;
  onCancelTrigger?: () => void;
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
      <div>
        <span>TP/SL Order</span>
        <br />
        {position.triggerOrder
          ? `${position.triggerOrder.orderState}${position.triggerOrder.rawState ? ` (${position.triggerOrder.rawState})` : ""}`
          : "not armed"}
      </div>
      {closed ? (
        <span className="hint">Closed</span>
      ) : (
        <div className="position-actions">
          <button
            className="secondary"
            disabled={globalBusy || busy || arming || syncingTrigger || cancellingTrigger || Boolean(position.triggerOrder)}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            {busy ? "Closing..." : position.triggerOrder ? "Cancel TP/SL first" : "Close now"}
          </button>
          {onLocalClose ? (
            <button
              className="secondary subtle"
              disabled={globalBusy || busy || arming || syncingTrigger || cancellingTrigger || Boolean(position.triggerOrder)}
              onClick={(event) => {
                event.stopPropagation();
                onLocalClose();
              }}
            >
              Local close
            </button>
          ) : null}
          {position.triggerOrder ? (
            <button
              className="secondary subtle"
              disabled={globalBusy || busy || arming || syncingTrigger || cancellingTrigger || !onSyncTrigger}
              onClick={(event) => {
                event.stopPropagation();
                onSyncTrigger?.();
              }}
            >
              {syncingTrigger ? "Syncing..." : "Sync TP/SL"}
            </button>
          ) : null}
          {position.triggerOrder ? (
            <button
              className="secondary subtle"
              disabled={globalBusy || busy || arming || syncingTrigger || cancellingTrigger || !onCancelTrigger}
              onClick={(event) => {
                event.stopPropagation();
                onCancelTrigger?.();
              }}
            >
              {cancellingTrigger ? "Cancelling..." : "Cancel TP/SL"}
            </button>
          ) : (
            <button
              className="secondary subtle"
              disabled={globalBusy || busy || arming || syncingTrigger || cancellingTrigger || !onArmTrigger}
              onClick={(event) => {
                event.stopPropagation();
                onArmTrigger?.();
              }}
            >
              {arming ? "Arming..." : "Arm TP/SL"}
            </button>
          )}
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

function isAccessForbiddenError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("access forbidden") || message.includes("403");
}

function isUserRejectedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("rejected") ||
    message.includes("declined") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("denied")
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function waitForSignatureConfirmationHttp(
  connection: Connection,
  signature: string,
  timeoutMs = 75_000,
  pollIntervalMs = 1_500
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const statusResponse = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true
    });
    const status = statusResponse.value[0];

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }

    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Transaction confirmation timed out for ${signature}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
