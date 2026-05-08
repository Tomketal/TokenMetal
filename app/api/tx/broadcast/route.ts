import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (shouldUseSandboxTrading()) {
      return NextResponse.json(
        {
          error:
            "Sandbox mode is active because live mainnet trading is not configured. Add SOLANA_RPC_URL for live broadcasts, or reload the app to use sandbox trading."
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { signedTransaction?: string };
    if (!body.signedTransaction) {
      return NextResponse.json({ error: "signedTransaction is required." }, { status: 400 });
    }

    const bytes = Buffer.from(body.signedTransaction, "base64");
    const connection = new Connection(appConfig.solanaRpcUrl, "confirmed");

    const signature = await connection.sendRawTransaction(bytes, {
      skipPreflight: true,
      maxRetries: 3
    });

    await waitForSignatureConfirmationHttp(connection, signature);
    return NextResponse.json({ signature });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to broadcast transaction.";
    return NextResponse.json(
      {
        error: detail.includes("Access forbidden") || detail.includes("403")
          ? `${detail} Configure SOLANA_RPC_URL with a write-enabled mainnet RPC for server-side broadcast.`
          : detail
      },
      { status: 400 }
    );
  }
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
