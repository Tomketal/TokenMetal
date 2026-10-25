import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { isValidStellarAddress, usdcAsset } from "@/lib/stellar/assets";
import { availableXlm, findBalance, loadAccountOrNull } from "@/lib/stellar/horizon";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner || !isValidStellarAddress(owner)) {
      return NextResponse.json({ error: "A valid Stellar `owner` address is required." }, { status: 400 });
    }

    const account = await loadAccountOrNull(owner);
    if (!account) {
      return NextResponse.json({
        balance: 0,
        rawAmount: "0",
        mint: appConfig.usdcAsset,
        decimals: appConfig.usdcDecimals,
        activated: false,
        hasUsdcTrustline: false,
        xlm: 0,
        xlmAvailable: 0
      });
    }

    const usdcLine = findBalance(account.balances, usdcAsset());
    const native = account.balances.find((line) => line.asset_type === "native");
    const balance = Number(usdcLine?.balance ?? 0);

    return NextResponse.json({
      balance,
      rawAmount: String(Math.round(balance * 10 ** appConfig.usdcDecimals)),
      mint: appConfig.usdcAsset,
      decimals: appConfig.usdcDecimals,
      activated: true,
      hasUsdcTrustline: Boolean(usdcLine),
      xlm: Number(native?.balance ?? 0),
      xlmAvailable: availableXlm(account)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch wallet balance." },
      { status: 400 }
    );
  }
}
