import { Horizon, NotFoundError } from "@stellar/stellar-sdk";
import { appConfig } from "@/lib/config";
import { STELLAR_DECIMALS } from "./network";
import type { Asset } from "@stellar/stellar-sdk";

let server: Horizon.Server | null = null;

export function horizon() {
  server ??= new Horizon.Server(appConfig.horizonUrl);
  return server;
}

export async function loadAccountOrNull(address: string) {
  try {
    return await horizon().loadAccount(address);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function loadActivatedAccount(address: string) {
  const account = await loadAccountOrNull(address);
  if (!account) {
    throw new Error("This Stellar account is not activated yet. Fund it with at least 2 XLM first.");
  }
  return account;
}

type AccountBalances = Horizon.AccountResponse["balances"];
type AssetBalance = Exclude<AccountBalances[number], Horizon.HorizonApi.BalanceLineLiquidityPool>;

export function findBalance(balances: AccountBalances, asset: Asset): AssetBalance | null {
  for (const line of balances) {
    if (line.asset_type === "liquidity_pool_shares") continue;
    if (asset.isNative()) {
      if (line.asset_type === "native") return line;
      continue;
    }
    if (
      line.asset_type !== "native" &&
      line.asset_code === asset.getCode() &&
      line.asset_issuer === asset.getIssuer()
    ) {
      return line;
    }
  }
  return null;
}

// Spendable XLM after the account's minimum balance and open-offer liabilities.
export function availableXlm(account: Horizon.AccountResponse, baseReserve = 0.5) {
  const native = account.balances.find((line) => line.asset_type === "native");
  const balance = Number(native?.balance ?? 0);
  const sellingLiabilities = Number(native?.selling_liabilities ?? 0);
  const sponsoring = Number(account.num_sponsoring ?? 0);
  const sponsored = Number(account.num_sponsored ?? 0);
  const minimum = (2 + account.subentry_count + sponsoring - sponsored) * baseReserve;
  return Math.max(0, balance - minimum - sellingLiabilities);
}

export function toRawUnits(amount: string | number) {
  return BigInt(Math.round(Number(amount) * 10 ** STELLAR_DECIMALS)).toString();
}
