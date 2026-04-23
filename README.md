# Token Letal

Token Letal is a simple Solana investment dApp for onboarding new users into crypto investing through a three-input decision flow:

1. Risk profile
2. Percentage of USDC wallet capital to invest
3. Expected holding period

The MVP uses a real Nansen-powered recommendation layer and Jupiter swap transactions signed by the user's Solflare wallet.

## Stack

- Next.js App Router + TypeScript
- Solana wallet adapter, Solflare enabled first
- Nansen API adapter for token recommendations
- Jupiter Swap API adapter for market buy and close flows
- Local JSON position store for hackathon development

No custom Solana program is required for the MVP. This app integrates existing protocols first.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Devnet Testing

For wallet and UI testing without mainnet funds:

```bash
cp .env.devnet.example .env.local
npm run dev
```

Then switch Solflare to Devnet. You can airdrop devnet SOL from the wallet or a faucet, and use devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

Important limitation: Nansen recommendations and Jupiter liquidity are mainly mainnet-oriented. In devnet, wallet connection, balance reads, Nansen calls, review UI, and positions UI are testable, but a real aggregator swap may fail if Jupiter cannot find a devnet route for the selected token.

The devnet preset enables:

```bash
NEXT_PUBLIC_DRY_RUN=true
```

In dry-run mode the app still calls Nansen, but the final trade button creates a sandbox position instead of requesting a Jupiter swap transaction or wallet trade signature. Mainnet keeps `NEXT_PUBLIC_DRY_RUN=false` for real execution.

To test wallet signing on devnet, use:

```bash
cp .env.devnet-signed.example .env.local
npm run dev
```

This disables dry-run and asks Solflare to sign a real transaction if Jupiter can build one. Because Nansen recommendations and Jupiter liquidity are mainnet-first, this may fail with "no route" for recommended tokens. A true devnet pool test needs a known devnet pool/mint pair and a direct Orca/Raydium adapter.

## Required Environment

```bash
NANSEN_API_KEY=your_nansen_key
NANSEN_AGENT_URL=https://api.nansen.ai/api/v1/agent/fast
NANSEN_USE_TOKEN_SCREENER=true
NANSEN_TOKEN_SCREENER_URL=https://api.nansen.ai/api/v1/token-screener

JUPITER_API_KEY=optional_jupiter_key
JUPITER_SWAP_BASE_URL=https://api.jup.ag/swap/v1
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDC_DECIMALS=6
FIXED_SLIPPAGE_BPS=75
```

## API Routes

- `POST /api/recommendations`
  - Calls the Nansen Token Screener endpoint by default because this path is verified for the MVP.
  - The Token Screener request uses Solana, `24h`, `only_smart_money`, token age 1-365 days, sorted by `buy_volume` descending.
  - If you set `NANSEN_USE_TOKEN_SCREENER=false`, the app calls the Nansen Agent Fast endpoint at `https://api.nansen.ai/api/v1/agent/fast`.
  - The Agent Fast adapter sends a structured investing prompt plus the user's wallet, USDC balance, risk profile, allocation, and holding period.

- `POST /api/trade`
  - `action: "prepare"` builds a Jupiter swap transaction from USDC into the selected token.
  - `action: "confirm"` creates a tracked position after the wallet sends the signed transaction.

- `GET /api/positions?owner=<wallet>`
  - Returns open and closed positions.
  - Open positions refresh PnL through Jupiter quotes.

- `POST /api/positions/close`
  - `action: "prepare"` builds a Jupiter swap transaction from the token back to USDC.
  - `action: "confirm"` marks the position closed after wallet execution.

## MVP Notes

- Recommendations are not mocked. Missing Nansen credentials return a configuration error.
- The Nansen Agent Fast adapter expects JSON output, but the parser also accepts common wrappers like `recommendations`, `data`, `result`, `response`, `output`, and fenced JSON text.
- Trade execution uses real Jupiter swap transactions and wallet signing.
- Position tracking is local-first and stores data in `data/positions.json`.
- One active position per token per wallet is enforced for MVP.
- Trailing stop is modeled in the interfaces and UI, but autonomous execution is intentionally left as a pluggable future worker.
- Mainnet is the practical default for Nansen/Jupiter/USDC. Devnet can be configured through env values, but aggregator liquidity may not exist there.

## Project Structure

```text
app/
  api/
    recommendations/
    trade/
    positions/
  page.tsx
lib/
  recommendations/
  trading/
  positions/
  types.ts
```

## Next Build Steps

1. Confirm the exact Nansen endpoint or custom agent payload you will use in the hackathon.
2. Add Phantom by appending a Phantom adapter in `app/providers.tsx`.
3. Replace the JSON store with Postgres, Supabase, or SQLite if multiple users will test concurrently.
4. Add a background job for take profit, stop loss, and trailing-stop monitoring.
