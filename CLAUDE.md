# Token Letal Project Context

Token Letal is a full-stack Solana dApp for simple investing. It is not an advanced discretionary trading terminal. It hides complexity behind three inputs and relies on Nansen intelligence plus Jupiter execution.

## Architecture

- Pattern: Next.js + existing Solana protocol integrations
- Wallet: Solflare first via Solana wallet adapter
- Recommendations: `lib/recommendations`
- Trading: `lib/trading`
- Positions: `lib/positions`
- API routes mirror product engines:
  - `POST /api/recommendations`
  - `POST /api/trade`
  - `GET /api/positions`
  - `POST /api/positions/close`

## Constraints

- Do not mock the core Nansen recommendation flow.
- Do not execute trades server-side without wallet signing.
- Keep trade execution wallet-based.
- Keep engines modular and replaceable.
- Prefer local-first development and readable hackathon code.

## Product UX

Desktop first. Solflare support first. Retro-futuristic cypherpunk direction, but keep the MVP plain, confident, and simple.

## External Integrations

- Nansen: requires `NANSEN_API_KEY`; default `NANSEN_AGENT_URL` is `https://api.nansen.ai/api/v1/agent/fast`.
- Jupiter: uses `JUPITER_SWAP_BASE_URL`, optional `JUPITER_API_KEY`.
- Solana RPC: `NEXT_PUBLIC_SOLANA_RPC_URL`.
