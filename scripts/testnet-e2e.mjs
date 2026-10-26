// End-to-end test of the Stellar trading protocol on testnet.
//
//   node scripts/testnet-e2e.mjs setup <state.json>
//     Creates throwaway accounts, a test USDC + TMTL token, and SDEX liquidity.
//     Prints the env vars to start the app with.
//
//   node scripts/testnet-e2e.mjs run <state.json> [baseUrl]
//     Drives /api like the browser would: prepare -> sign -> broadcast -> confirm,
//     then closes the position and checks commission, PnL and trustline cleanup.
//
// Keys are generated per run, funded by Friendbot and only ever touch testnet.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const horizon = new Horizon.Server(HORIZON_URL);
const [mode, statePath, baseUrl = "http://localhost:3107"] = process.argv.slice(2);

if (mode === "setup") await setup();
else if (mode === "run") await run();
else {
  console.error("Usage: node scripts/testnet-e2e.mjs <setup|run> <state.json> [baseUrl]");
  process.exit(1);
}

async function setup() {
  const keys = Object.fromEntries(
    ["usdcIssuer", "tokenIssuer", "maker", "user", "treasury"].map((name) => [name, Keypair.random()])
  );
  await Promise.all(Object.values(keys).map((kp) => fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)));
  console.log("Funded accounts with Friendbot");

  const usdc = new Asset("USDC", keys.usdcIssuer.publicKey());
  const tmtl = new Asset("TMTL", keys.tokenIssuer.publicKey());

  await submit(keys.maker, [Operation.changeTrust({ asset: usdc }), Operation.changeTrust({ asset: tmtl })]);
  await submit(keys.user, [Operation.changeTrust({ asset: usdc })]);
  await submit(keys.treasury, [Operation.changeTrust({ asset: usdc })]);
  await submit(keys.usdcIssuer, [
    Operation.payment({ destination: keys.maker.publicKey(), asset: usdc, amount: "10000" }),
    Operation.payment({ destination: keys.user.publicKey(), asset: usdc, amount: "100" })
  ]);
  await submit(keys.tokenIssuer, [
    Operation.payment({ destination: keys.maker.publicKey(), asset: tmtl, amount: "100000" })
  ]);
  // Ask 0.10 USDC per TMTL, bid ~0.0909 USDC per TMTL (1 USDC buys 11 TMTL).
  await submit(keys.maker, [
    Operation.manageSellOffer({ selling: tmtl, buying: usdc, amount: "50000", price: "0.1" }),
    Operation.manageSellOffer({ selling: usdc, buying: tmtl, amount: "2000", price: "11" })
  ]);
  console.log("Created test USDC/TMTL order book");

  const state = {
    usdcAsset: `USDC:${keys.usdcIssuer.publicKey()}`,
    tokenAsset: `TMTL:${keys.tokenIssuer.publicKey()}`,
    userPublic: keys.user.publicKey(),
    userSecret: keys.user.secret(),
    treasuryPublic: keys.treasury.publicKey()
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`State written to ${statePath}\nStart the app with:`);
  console.log(
    `NEXT_PUBLIC_STELLAR_NETWORK=testnet NEXT_PUBLIC_DRY_RUN=false NEXT_PUBLIC_USDC_ASSET=${state.usdcAsset} TREASURY_WALLET=${state.treasuryPublic}`
  );
}

async function run() {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const user = Keypair.fromSecret(state.userSecret);
  const owner = user.publicKey();
  const recommendation = {
    id: "e2e",
    tokenName: "Token Metal Test",
    tokenSymbol: "TMTL",
    mintAddress: state.tokenAsset,
    confidenceScore: 1,
    riskScore: 50,
    expectedHoldingPeriod: "1 week",
    entryRationale: "e2e",
    takeProfit: "+10%",
    stopLoss: "-10%",
    estimatedUpside: "+10%",
    estimatedDownside: "-10%",
    profileMatch: "e2e",
    nansenSource: "e2e"
  };

  const status = await api("GET", "/api/trade/status");
  check(status.network === "testnet" && status.liveTradingEnabled, "server is in live testnet mode", status);
  check(status.commissionEnabled, "commission is enabled");

  const before = await api("GET", `/api/wallet/balance?owner=${owner}`);
  check(before.balance === 100, `user starts with 100 USDC (has ${before.balance})`);

  // 1. A stale transaction must come back as "expired" so the client re-prepares.
  const stale = await api("POST", "/api/trade", { action: "prepare", owner, amountUsdc: 10, recommendation });
  await submit(user, [Operation.bumpSequence({ bumpTo: "0" })]);
  const staleResult = await api("POST", "/api/tx/broadcast", { signedTransaction: sign(stale.preparedTrade.swapTransaction, user) }, true);
  check(staleResult.code === "expired", "stale transaction is reported as expired", staleResult);

  // 2. Buy 10 USDC of TMTL.
  const { preparedTrade } = await api("POST", "/api/trade", { action: "prepare", owner, amountUsdc: 10, recommendation });
  check(preparedTrade.commissionUsdc === 0.2, `quote charges 0.2 USDC (2%) commission (${preparedTrade.commissionUsdc})`);
  check(preparedTrade.quoteResponse.addsTrustline === true, "buy adds the TMTL trustline");
  const buy = await api("POST", "/api/tx/broadcast", { signedTransaction: sign(preparedTrade.swapTransaction, user) });
  console.log(`  buy tx ${buy.signature}`);
  const { position } = await api("POST", "/api/trade", { action: "confirm", owner, signature: buy.signature, preparedTrade });
  check(Math.abs(position.tokenAmountUi - 98) < 0.001, `position holds 98 TMTL (${position.tokenAmountUi})`);

  const afterBuy = await api("GET", `/api/wallet/balance?owner=${owner}`);
  check(Math.abs(afterBuy.balance - 90) < 1e-6, `user has 90 USDC after buying (${afterBuy.balance})`);
  check(await usdcBalanceOf(state.treasuryPublic, state.usdcAsset) === 0.2, "treasury received 0.2 USDC");

  // 3. Live PnL marks the position against the bid side.
  const listed = await api("GET", `/api/positions?owner=${owner}`);
  const open = listed.open.find((item) => item.id === position.id);
  check(open && open.pnlPercent < 0, `open PnL is marked to the bid (${open?.pnlPercent?.toFixed(2)}%)`);

  // 4. Close it. With E2E_WIPE_POSITIONS set to the server's positions file, the
  // store is wiped first, like a serverless instance that never saw the buy;
  // the close must still work from the client's copy of the position.
  if (process.env.E2E_WIPE_POSITIONS) {
    if (existsSync(process.env.E2E_WIPE_POSITIONS)) unlinkSync(process.env.E2E_WIPE_POSITIONS);
    console.log("  wiped server position store");
  }
  const { closeTrade } = await api("POST", "/api/positions/close", { action: "prepare", owner, positionId: position.id, position });
  check(closeTrade.quoteResponse.removesTrustline === true, "close removes the TMTL trustline");
  const sell = await api("POST", "/api/tx/broadcast", { signedTransaction: sign(closeTrade.swapTransaction, user) });
  console.log(`  close tx ${sell.signature}`);
  const closed = await api("POST", "/api/positions/close", { action: "confirm", owner, positionId: position.id, signature: sell.signature, position });
  const expectedExit = 98 / 11;
  check(closed.position.status === "closed", "position is closed");
  check(Math.abs(closed.position.currentValueUsd - expectedExit) < 0.001, `exit value is ${expectedExit.toFixed(4)} USDC (${closed.position.currentValueUsd})`);
  check(Math.abs(closed.position.pnlUsd - (expectedExit - 10)) < 0.001, `realized PnL ${closed.position.pnlUsd.toFixed(4)} USDC`);

  const account = await horizon.loadAccount(owner);
  check(!account.balances.some((line) => line.asset_code === "TMTL"), "TMTL trustline is gone (reserve returned)");

  const txs = await api("GET", `/api/transactions?owner=${owner}`);
  check(txs.summary.buyCount === 1 && txs.summary.sellCount === 1, "ledger recorded 1 buy and 1 sell");
  console.log("\nAll checks passed.");
}

async function api(method, path, body, allowError = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok && !allowError) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function sign(xdr, keypair) {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  transaction.sign(keypair);
  return transaction.toXDR();
}

async function submit(keypair, operations) {
  const account = await horizon.loadAccount(keypair.publicKey());
  const builder = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET });
  operations.forEach((operation) => builder.addOperation(operation));
  const transaction = builder.setTimeout(60).build();
  transaction.sign(keypair);
  return horizon.submitTransaction(transaction);
}

async function usdcBalanceOf(address, assetId) {
  const [code, issuer] = assetId.split(":");
  const account = await horizon.loadAccount(address);
  const line = account.balances.find((item) => item.asset_code === code && item.asset_issuer === issuer);
  return Number(line?.balance ?? 0);
}

function check(condition, label, detail) {
  if (!condition) {
    console.error(`✗ ${label}`, detail ? JSON.stringify(detail) : "");
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}
