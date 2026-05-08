import { NextResponse } from "next/server";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const nativeSolMint = "So11111111111111111111111111111111111111112";
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const capitalMint =
  process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const capitalDecimals = Number(process.env.USDC_DECIMALS || process.env.NEXT_PUBLIC_CAPITAL_DECIMALS || 6);

function fromRawAmount(rawAmount: string, decimals: number) {
  return Number(rawAmount) / 10 ** decimals;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }

    const ownerPublicKey = new PublicKey(owner);
    const connection = new Connection(rpcUrl, "confirmed");

    if (capitalMint === nativeSolMint) {
      const lamports = await connection.getBalance(ownerPublicKey);
      return NextResponse.json({
        balance: fromRawAmount(String(lamports), capitalDecimals),
        rawAmount: String(lamports),
        mint: capitalMint,
        decimals: capitalDecimals,
        source: "native"
      });
    }

    const mintPublicKey = new PublicKey(capitalMint);
    const associatedTokenAccount = getAssociatedTokenAddressSync(mintPublicKey, ownerPublicKey, false);

    try {
      const ataBalance = await connection.getTokenAccountBalance(associatedTokenAccount);
      return NextResponse.json({
        balance: fromRawAmount(ataBalance.value.amount, capitalDecimals),
        rawAmount: ataBalance.value.amount,
        mint: capitalMint,
        decimals: capitalDecimals,
        associatedTokenAccount: associatedTokenAccount.toBase58(),
        source: "ata"
      });
    } catch {
      const accounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
        mint: mintPublicKey
      });
      const rawAmount = accounts.value.reduce((sum, account) => {
        const amount = account.account.data.parsed.info.tokenAmount.amount as string;
        return sum + BigInt(amount);
      }, 0n);

      return NextResponse.json({
        balance: fromRawAmount(rawAmount.toString(), capitalDecimals),
        rawAmount: rawAmount.toString(),
        mint: capitalMint,
        decimals: capitalDecimals,
        source: "sum",
        tokenAccountsFound: accounts.value.length
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch wallet balance." },
      { status: 400 }
    );
  }
}
