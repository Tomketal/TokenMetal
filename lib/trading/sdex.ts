import { Operation, TransactionBuilder, type Asset, type Horizon, type xdr } from "@stellar/stellar-sdk";
import { TREASURY_WALLET, computeCommission, isCommissionEnabled } from "@/lib/commission";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";
import { toRawAmount, toStellarAmount } from "@/lib/number";
import { assetFromHorizon, parseAsset, usdcAsset } from "@/lib/stellar/assets";
import { availableXlm, findBalance, horizon, loadAccountOrNull, loadActivatedAccount } from "@/lib/stellar/horizon";
import { STELLAR_DECIMALS } from "@/lib/stellar/network";
import type { PreparedTrade, TokenRecommendation } from "@/lib/types";

// Swap engine on the native Stellar DEX (order books + AMM pools) using
// path payments. Every transaction is built here unsigned and signed by the
// user's wallet; the server never holds keys.

const TRUSTLINE_RESERVE_XLM = 0.5;
const FEE_HEADROOM_XLM = 0.01;

export interface SwapQuote {
  sendAsset: string;
  sendAmount: string;
  destAsset: string;
  destAmount: string;
  destMin: string;
  path: string[];
}

export async function prepareBuyTrade(owner: string, amountUsdc: number, recommendation: TokenRecommendation): Promise<PreparedTrade> {
  const amountUsdcRaw = toRawAmount(amountUsdc, STELLAR_DECIMALS);
  if (shouldUseSandboxTrading()) {
    return prepareDryRunBuyTrade(owner, amountUsdc, amountUsdcRaw, recommendation);
  }

  const usdc = usdcAsset();
  const destAsset = parseAsset(recommendation.mintAddress);
  if (destAsset.equals(usdc)) throw new Error("Cannot buy USDC with USDC.");

  const account = await loadActivatedAccount(owner);
  const usdcLine = findBalance(account.balances, usdc);
  if (!usdcLine || Number(usdcLine.balance) < amountUsdc) {
    throw new Error(`Not enough USDC. Balance: ${usdcLine?.balance ?? "0"} USDC, needed: ${amountUsdc}.`);
  }

  const commissionUsdc = isCommissionEnabled() ? Number(toStellarAmount(computeCommission(amountUsdc))) : 0;
  if (commissionUsdc > 0) await assertTreasuryCanReceiveUsdc();

  const sendAmount = toStellarAmount(amountUsdc - commissionUsdc);
  const quote = await quoteStrictSend(usdc, sendAmount, destAsset);

  const needsTrustline = !destAsset.isNative() && !findBalance(account.balances, destAsset);
  const xlmNeeded = (needsTrustline ? TRUSTLINE_RESERVE_XLM : 0) + FEE_HEADROOM_XLM;
  if (availableXlm(account) < xlmNeeded) {
    throw new Error(
      `Not enough XLM for this trade. You need about ${xlmNeeded} spendable XLM` +
        (needsTrustline ? ` (0.5 XLM reserve for the new ${destAsset.getCode()} trustline plus fees).` : " for fees.")
    );
  }

  const operations: xdr.Operation[] = [];
  if (needsTrustline) operations.push(Operation.changeTrust({ asset: destAsset }));
  if (commissionUsdc > 0) {
    operations.push(
      Operation.payment({ destination: TREASURY_WALLET, asset: usdc, amount: toStellarAmount(commissionUsdc) })
    );
  }
  operations.push(pathPaymentOp(owner, usdc, destAsset, quote));

  const swapTransaction = await buildTransaction(account, operations);
  const expectedTokenAmountUi = Number(quote.destAmount);
  const upside = signedPercent(recommendation.estimatedUpside);
  const downside = Math.abs(signedPercent(recommendation.estimatedDownside));

  return {
    id: crypto.randomUUID(),
    owner,
    inputMint: appConfig.usdcAsset,
    outputMint: recommendation.mintAddress,
    amountUsdc,
    amountUsdcRaw,
    commissionUsdc,
    expectedTokenAmountRaw: toRawAmount(expectedTokenAmountUi, STELLAR_DECIMALS),
    expectedTokenAmountUi,
    expectedReturnUsd: amountUsdc * (upside / 100),
    expectedLossUsd: amountUsdc * (downside / 100),
    recommendation: { ...recommendation, tokenDecimals: STELLAR_DECIMALS },
    quoteResponse: { ...quote, addsTrustline: needsTrustline },
    swapTransaction,
    createdAt: new Date().toISOString()
  };
}

export async function prepareCloseTrade(owner: string, assetId: string, tokenAmountRaw: string) {
  if (shouldUseSandboxTrading()) {
    return {
      quoteResponse: { dryRun: true, inputMint: assetId, outputMint: appConfig.usdcAsset, amount: tokenAmountRaw },
      swapTransaction: ""
    };
  }

  const usdc = usdcAsset();
  const sellAsset = parseAsset(assetId);
  const account = await loadActivatedAccount(owner);
  const line = findBalance(account.balances, sellAsset);
  const balance = Number(line?.balance ?? 0);
  if (balance <= 0) throw new Error("This wallet no longer holds the position's token.");
  if (availableXlm(account) < FEE_HEADROOM_XLM) throw new Error("Not enough XLM to pay the network fee.");

  const positionAmount = Number(tokenAmountRaw) / 10 ** STELLAR_DECIMALS;
  const sendAmount = toStellarAmount(Math.min(positionAmount, balance));
  const quote = await quoteStrictSend(sellAsset, sendAmount, usdc);

  const operations: xdr.Operation[] = [pathPaymentOp(owner, sellAsset, usdc, quote)];

  // Selling the whole balance lets us drop the trustline and give the user back
  // the 0.5 XLM reserve, as long as no open offers still reference the asset.
  const sellsEverything = sendAmount === toStellarAmount(balance);
  const hasLiabilities = Number(line?.buying_liabilities ?? 0) > 0 || Number(line?.selling_liabilities ?? 0) > 0;
  const removesTrustline = !sellAsset.isNative() && sellsEverything && !hasLiabilities;
  if (removesTrustline) operations.push(Operation.changeTrust({ asset: sellAsset, limit: "0" }));

  return {
    quoteResponse: { ...quote, removesTrustline },
    swapTransaction: await buildTransaction(account, operations)
  };
}

export async function getTokenValueInUsdc(assetId: string, amountRaw: string) {
  const usdc = usdcAsset();
  const asset = parseAsset(assetId);
  const amount = toStellarAmount(Number(amountRaw) / 10 ** STELLAR_DECIMALS);
  if (asset.equals(usdc)) return Number(amount);

  const quote = await quoteStrictSend(asset, amount, usdc);
  return Number(quote.destAmount);
}

export interface SwapResult {
  sourceAmount: number;
  destAmount: number;
}

// Reads what a confirmed swap actually paid and received, so positions are
// recorded from chain data instead of the pre-trade quote.
export async function readSwapResult(hash: string, owner: string): Promise<SwapResult> {
  const transaction = await horizon().transactions().transaction(hash).call();
  if (!transaction.successful) throw new Error("Transaction failed on-chain.");
  if (transaction.source_account !== owner) throw new Error("Transaction was not sent by this wallet.");

  const operations = await horizon().operations().forTransaction(hash).limit(20).call();
  const swap = operations.records.find(
    (op): op is Horizon.ServerApi.PathPaymentStrictSendOperationRecord => op.type === "path_payment_strict_send"
  );
  if (!swap) throw new Error("No swap found in this transaction.");

  return { sourceAmount: Number(swap.source_amount), destAmount: Number(swap.amount) };
}

async function quoteStrictSend(sendAsset: Asset, sendAmount: string, destAsset: Asset): Promise<SwapQuote> {
  const response = await horizon().strictSendPaths(sendAsset, sendAmount, [destAsset]).call();
  const best = response.records.reduce<(typeof response.records)[number] | null>(
    (top, record) => (!top || Number(record.destination_amount) > Number(top.destination_amount) ? record : top),
    null
  );
  if (!best || Number(best.destination_amount) <= 0) {
    throw new Error(`No Stellar DEX route found for ${labelOf(sendAsset)} -> ${labelOf(destAsset)}.`);
  }

  const destMin = toStellarAmount(Number(best.destination_amount) * (1 - appConfig.fixedSlippageBps / 10_000));
  return {
    sendAsset: idOf(sendAsset),
    sendAmount,
    destAsset: idOf(destAsset),
    destAmount: best.destination_amount,
    destMin,
    path: best.path.map((hop) => idOf(assetFromHorizon(hop)))
  };
}

function pathPaymentOp(owner: string, sendAsset: Asset, destAsset: Asset, quote: SwapQuote) {
  return Operation.pathPaymentStrictSend({
    sendAsset,
    sendAmount: quote.sendAmount,
    destination: owner,
    destAsset,
    destMin: quote.destMin,
    path: quote.path.map(parseAsset)
  });
}

async function buildTransaction(account: Horizon.AccountResponse, operations: xdr.Operation[]) {
  const baseFee = await horizon().fetchBaseFee();
  // 10x the base fee keeps us ahead of mild surge pricing; still ~0.0001 XLM per op.
  const builder = new TransactionBuilder(account, {
    fee: String(Math.max(baseFee, 100) * 10),
    networkPassphrase: appConfig.networkPassphrase
  });
  for (const operation of operations) builder.addOperation(operation);
  return builder.setTimeout(appConfig.txTimeoutSeconds).build().toXDR();
}

let treasuryReady = false;

async function assertTreasuryCanReceiveUsdc() {
  if (treasuryReady) return;
  const treasury = await loadAccountOrNull(TREASURY_WALLET);
  if (!treasury || !findBalance(treasury.balances, usdcAsset())) {
    throw new Error("Treasury wallet has no USDC trustline. Add one before live trading, or unset TREASURY_WALLET.");
  }
  treasuryReady = true;
}

function prepareDryRunBuyTrade(owner: string, amountUsdc: number, amountUsdcRaw: string, recommendation: TokenRecommendation): PreparedTrade {
  const assumedTokenPrice = Math.max(0.000001, amountUsdc >= 25 ? 0.25 : 0.05);
  const expectedTokenAmountUi = amountUsdc / assumedTokenPrice;
  const upside = signedPercent(recommendation.estimatedUpside);
  const downside = Math.abs(signedPercent(recommendation.estimatedDownside));

  return {
    id: crypto.randomUUID(),
    owner,
    inputMint: appConfig.usdcAsset,
    outputMint: recommendation.mintAddress,
    amountUsdc,
    amountUsdcRaw,
    commissionUsdc: 0,
    expectedTokenAmountRaw: toRawAmount(expectedTokenAmountUi, STELLAR_DECIMALS),
    expectedTokenAmountUi,
    expectedReturnUsd: amountUsdc * (upside / 100),
    expectedLossUsd: amountUsdc * (downside / 100),
    recommendation: { ...recommendation, tokenDecimals: STELLAR_DECIMALS },
    quoteResponse: { dryRun: true, assumedTokenPrice },
    swapTransaction: "",
    createdAt: new Date().toISOString()
  };
}

function idOf(asset: Asset) {
  return asset.isNative() ? "native" : `${asset.getCode()}:${asset.getIssuer()}`;
}

function labelOf(asset: Asset) {
  return asset.isNative() ? "XLM" : asset.getCode();
}

function signedPercent(value: string) {
  const parsed = Number(value.replace("%", "").replace("+", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
