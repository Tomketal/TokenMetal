import { NextResponse } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";
import { horizon } from "@/lib/stellar/horizon";
import { broadcastRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Result codes that mean "build the transaction again and re-sign":
// it expired (time bounds) or another transaction used the sequence number.
const STALE_TX_CODES = new Set(["tx_too_late", "tx_bad_seq"]);

const OPERATION_MESSAGES: Record<string, string> = {
  op_under_dest_min: "Price moved more than the allowed slippage. Prepare the trade again.",
  op_too_few_offers: "Not enough liquidity on the Stellar DEX for this trade right now.",
  op_underfunded: "Not enough balance to complete this trade.",
  op_low_reserve: "Not enough XLM to cover the account reserve for a new token.",
  op_no_trust: "A required trustline is missing (yours or the treasury's).",
  op_line_full: "Your trustline limit for this token is full."
};

export async function POST(request: Request) {
  if (shouldUseSandboxTrading()) {
    return NextResponse.json({ error: "Sandbox mode is active; nothing is broadcast." }, { status: 400 });
  }

  try {
    const { signedTransaction } = broadcastRequestSchema.parse(await request.json());
    const transaction = TransactionBuilder.fromXDR(signedTransaction, appConfig.networkPassphrase);
    const response = await horizon().submitTransaction(transaction);
    return NextResponse.json({ signature: response.hash, ledger: response.ledger });
  } catch (error) {
    const codes = resultCodes(error);
    if (codes && STALE_TX_CODES.has(codes.transaction)) {
      return NextResponse.json(
        { error: "The transaction expired before it was sent. Prepare it again and re-sign.", code: "expired" },
        { status: 409 }
      );
    }

    const operationCode = codes?.operations?.find((code) => code !== "op_success");
    const message =
      (operationCode && OPERATION_MESSAGES[operationCode]) ||
      (codes ? `Transaction rejected: ${codes.transaction}${operationCode ? ` / ${operationCode}` : ""}` : null) ||
      (error instanceof Error ? error.message : "Unable to broadcast transaction.");

    return NextResponse.json({ error: message, code: operationCode || codes?.transaction }, { status: 400 });
  }
}

function resultCodes(error: unknown) {
  const extras = (error as { response?: { data?: { extras?: { result_codes?: unknown } } } })?.response?.data?.extras;
  return extras?.result_codes as { transaction: string; operations?: string[] } | undefined;
}
