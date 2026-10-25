import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { listPositions } from "@/lib/positions/store";
import { explorerTxUrl } from "@/lib/stellar/network";
import {
  listTransactions,
  summarizeTransactions,
  syncTransactionsFromPositions,
  transactionsDbPath
} from "@/lib/transactions/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

export default async function TransactionsPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = ((await searchParams) || {}) as Record<
    string,
    string | string[] | undefined
  >;
  const ownerParam = resolvedSearchParams.owner;
  const owner =
    typeof ownerParam === "string"
      ? ownerParam.trim() || undefined
      : Array.isArray(ownerParam) && ownerParam[0]
        ? ownerParam[0].trim() || undefined
        : undefined;

  if (!owner) {
    return (
      <main style={{ padding: "28px 18px 52px", maxWidth: 900, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 32 }}>Transactions Database</h1>
            <p style={{ margin: "8px 0 0", opacity: 0.82 }}>
              Open this page from your connected wallet link so only your wallet data is shown.
            </p>
          </div>
          <Link href="/" style={linkButtonStyle}>
            Back To Trading
          </Link>
        </header>
      </main>
    );
  }

  const positions = await listPositions(owner);
  await syncTransactionsFromPositions(positions);

  const [transactions, summary] = await Promise.all([
    listTransactions(owner),
    summarizeTransactions(owner)
  ]);

  const openPositions = positions.filter((position) => position.status === "open");
  const closedPositions = positions.filter((position) => position.status === "closed");
  const unrealizedPnlUsd = openPositions.reduce(
    (sum, position) => sum + (position.pnlUsd || 0),
    0
  );
  const closedPnlUsd = closedPositions.reduce(
    (sum, position) => sum + (position.pnlUsd || 0),
    0
  );

  const ownerQuery = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  const exportHref = `/api/transactions/export${ownerQuery}`;
  const jsonHref = `/api/transactions${ownerQuery}`;

  return (
    <main style={{ padding: "28px 18px 52px", maxWidth: 1300, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Transactions Database</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.82 }}>
            Owner: <code>{owner}</code>
          </p>
          <p style={{ margin: "6px 0 0", opacity: 0.76 }}>
            Local SQLite file: <code>{transactionsDbPath}</code>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={exportHref}
            style={linkButtonStyle}
          >
            Download CSV
          </Link>
          <Link
            href={jsonHref}
            style={linkButtonStyle}
          >
            View JSON API
          </Link>
          <Link
            href="/"
            style={linkButtonStyle}
          >
            Back To Trading
          </Link>
        </div>
      </header>

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 10
        }}
      >
        <MetricCard label="Total Transactions" value={String(summary.totalTransactions)} />
        <MetricCard label="Buys / Sells" value={`${summary.buyCount} / ${summary.sellCount}`} />
        <MetricCard label="Volume (USDC)" value={formatMoney(summary.tradedVolumeUsdc)} />
        <MetricCard label="Realized PnL" value={formatMoney(summary.realizedPnlUsdc)} />
        <MetricCard label="Unrealized PnL (Open)" value={formatMoney(unrealizedPnlUsd)} />
        <MetricCard label="Closed PnL (Positions)" value={formatMoney(closedPnlUsd)} />
        <MetricCard label="Total Fees" value={formatMoney(summary.totalFeesUsdc)} />
        <MetricCard label="Win Rate" value={`${formatPercent(summary.winRatePercent)} (${summary.winningSellCount}/${summary.sellCount})`} />
        <MetricCard label="Open / Closed Positions" value={`${openPositions.length} / ${closedPositions.length}`} />
      </section>

      <section
        style={{
          marginTop: 18,
          overflowX: "auto",
          border: "1px solid rgba(14, 24, 20, 0.2)",
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.62)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(216, 235, 229, 0.68)" }}>
              <Th>Time</Th>
              <Th>Side</Th>
              <Th>Owner</Th>
              <Th>Token</Th>
              <Th>Amount In</Th>
              <Th>Amount Out</Th>
              <Th>Value (USDC)</Th>
              <Th>Fee</Th>
              <Th>PnL</Th>
              <Th>PnL %</Th>
              <Th>Signature</Th>
              <Th>Engine</Th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 16, opacity: 0.72 }}>
                  No transactions yet. Execute a trade to start filling the database.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ borderTop: "1px solid rgba(14, 24, 20, 0.12)" }}
                >
                  <Td>{formatDateTime(transaction.occurredAt)}</Td>
                  <Td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          transaction.side === "buy"
                            ? "rgba(57, 111, 214, 0.14)"
                            : "rgba(26, 156, 80, 0.14)",
                        fontWeight: 700
                      }}
                    >
                      {transaction.side}
                    </span>
                  </Td>
                  <Td>{shorten(transaction.owner)}</Td>
                  <Td>
                    {transaction.tokenSymbol}
                    <br />
                    <span style={{ opacity: 0.65 }}>{transaction.tokenName}</span>
                  </Td>
                  <Td>{formatTokenAmount(transaction.inputAmountUi)}</Td>
                  <Td>{formatTokenAmount(transaction.outputAmountUi)}</Td>
                  <Td>{formatMoney(transaction.amountUsdc)}</Td>
                  <Td>{formatMoney(transaction.feeUsdc)}</Td>
                  <Td>{formatNullableMoney(transaction.pnlUsdc)}</Td>
                  <Td>{formatNullablePercent(transaction.pnlPercent)}</Td>
                  <Td>
                    <a
                      href={explorerTxUrl(transaction.signature)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#1d5676", textDecoration: "none" }}
                    >
                      {shorten(transaction.signature)}
                    </a>
                  </Td>
                  <Td>{transaction.engine || "-"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article
      style={{
        border: "1px solid rgba(14, 24, 20, 0.16)",
        borderRadius: 12,
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.62)"
      }}
    >
      <div style={{ opacity: 0.72, fontSize: 12 }}>{label}</div>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </article>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: "9px 8px", verticalAlign: "top" }}>{children}</td>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6
  }).format(value);
}

function formatNullableMoney(value: number | null) {
  if (value === null) return "-";
  return formatMoney(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatNullablePercent(value: number | null) {
  if (value === null) return "-";
  return formatPercent(value);
}

function formatTokenAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8
  }).format(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function shorten(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

const linkButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid rgba(14, 24, 20, 0.32)",
  padding: "8px 12px",
  background: "rgba(12, 25, 27, 0.84)",
  color: "#e5f4ef",
  fontWeight: 700,
  textDecoration: "none"
};
