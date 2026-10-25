# Token Letal Project Context

Token Letal (Token Metal) is a full-stack Stellar dApp for simple investing. It is not an advanced discretionary trading terminal. It hides complexity behind three inputs (risk, % of USDC, holding period), recommends tokens and executes the trade on the Stellar DEX.

## Architecture

- Pattern: Next.js + existing Stellar protocol integrations
- Wallet: Stellar Wallets Kit (Freighter, xBull, Lobstr, Albedo, ...) in `app/providers.tsx`
- Stellar helpers: `lib/stellar` (network, assets, Horizon)
- Recommendations: `lib/recommendations`
- Trading: `lib/trading/sdex.ts` (path payments on the Stellar DEX, 0.5% fee as an extra payment op)
- Positions: `lib/positions`
- API routes mirror product engines:
  - `POST /api/recommendations`
  - `POST /api/trade` (prepare -> wallet signs -> `POST /api/tx/broadcast` -> confirm)
  - `GET /api/positions`
  - `POST /api/positions/close`
- `/dev` is a bare protocol test bench; the product UI is owned by the UX branch.
- `scripts/testnet-e2e.mjs` runs the full buy/close flow on testnet against a local server.

## Constraints

- Recommendations must use real market data; never mock them. Nansen does not cover Stellar (verified Oct 2026), so Stellar data sources replace it.
- Do not execute trades server-side without wallet signing.
- Keep trade execution wallet-based: the server only builds unsigned XDR and relays signed XDR.
- Record positions from on-chain results (`readSwapResult`), not from quotes.
- Keep engines modular and replaceable.
- Prefer local-first development and readable hackathon code.

## Stellar specifics

- Asset ids are `CODE:ISSUER` or `native`; classic assets use 7 decimals.
- Buying a new token adds a trustline (0.5 XLM reserve); closing a full position removes it.
- Prepared transactions expire after `TX_TIMEOUT_SECONDS`; the broadcast route returns `code: "expired"` so clients re-prepare.

## Product UX

Desktop first. Retro-futuristic cypherpunk direction, but keep the MVP plain, confident, and simple.
