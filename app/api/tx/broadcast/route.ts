import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

export const runtime = "nodejs";

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { signedTransaction?: string };
    if (!body.signedTransaction) {
      return NextResponse.json({ error: "signedTransaction is required." }, { status: 400 });
    }

    const bytes = Buffer.from(body.signedTransaction, "base64");
    const connection = new Connection(rpcUrl, "confirmed");

    const signature = await connection.sendRawTransaction(bytes, {
      skipPreflight: true,
      maxRetries: 3
    });

    await waitForSignatureConfirmationHttp(connection, signature);
    return NextResponse.json({ signature });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to broadcast transaction." },
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
