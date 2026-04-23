# Superteam Agentic Engineering Grant Application Draft

Submission link: https://superteam.fun/earn/grants/agentic-engineering

Verified from listing on April 23, 2026:
- Applications close May 4, 2026.
- Solana Frontier Hackathon submission deadline is May 11, 2026.
- Grant amount is 200 USDG, paid 50% upfront and 50% after shipping.

## Step 1: Basics

**Project Title**
> Token Letal

**One Line Description**
> Token Letal is a Solana investment assistant that converts three user inputs into Nansen-backed token picks and executes wallet-signed Jupiter swaps in a guided flow.

**TG username**
> t.me/tomketal

**Wallet Address**
> 4NeusmGXM4JffYkdfSqLi54C2qrBLTeMVFMJge5QN75S

## Step 2: Details

**Project Details**
> Token Letal solves a core onboarding problem: new users want exposure to Solana tokens, but they do not know how to research opportunities, size positions, or execute safely.
>
> The current MVP asks users for risk profile, allocation percentage, and holding period, then generates recommendations via Nansen intelligence and executes real swap transactions through Jupiter with wallet signatures. The app also tracks open and closed positions with ongoing PnL updates and close flows. This keeps discovery, execution, and tracking in one simple loop for non-advanced users.
>
> I am building and shipping this using the solana.new workflow. Existing context files already show use of `scaffold-project`, and I am using the same stack and skill pipeline (`build-with-claude`, `review-and-iterate`, and `submit-to-hackathon`) to harden the app and submit a polished Frontier project.

**Deadline**
> May 10, 2026 (23:00 Europe/Madrid) for MVP freeze, then final Colosseum submission by May 11, 2026.

**Proof of Work**
> - Core product docs and architecture: `README.md` and `.superstack/build-context.md`
> - Recommendation backend (Nansen integration): `app/api/recommendations/route.ts` and `lib/recommendations/nansen.ts`
> - Trade backend (Jupiter swap prep and confirmation): `app/api/trade/route.ts` and `lib/trading/jupiter.ts`
> - Position lifecycle and PnL tracking: `app/api/positions/route.ts`, `app/api/positions/close/route.ts`, `lib/positions/store.ts`
> - Frontend user flow and wallet signing: `app/page.tsx`
> - AI-assisted build transcript exported for grant review: `codex-session.jsonl`
> - Note: this local workspace currently has no git remote configured; I will publish the private/public repo link before final submission.

**Personal X Profile**
> x.com/tomketal

**Personal GitHub Profile**
> https://github.com/Tomketal

**Colosseum Crowdedness Score**
> Public Drive folder for crowdedness screenshot and response files: https://drive.google.com/drive/folders/19CyDynMwqx7B3frZBWXQx10nZke7NW0t?usp=sharing

**AI Session Transcript**
> Attached as `codex-session.jsonl` from project root.

## Step 3: Milestones

**Goals and Milestones**
> 1. April 24-26, 2026: Ship recommendation and trade flow hardening (validation errors, edge cases, stable wallet UX).
> 2. April 27-30, 2026: Improve position management and safety controls (close flow reliability, risk guardrails, clearer PnL surfaces).
> 3. May 1-4, 2026: Complete integration QA, run test-user sessions, and prepare production-grade docs/demo assets.
> 4. May 5-9, 2026: Final polish using solana.new review skills, package demo, and rehearse submission narrative.
> 5. May 10-11, 2026: Submit final project to Colosseum Frontier with repo, live/demo URL, and supporting artifacts.

**Primary KPI**
> 30 completed recommendation-to-trade sessions (wallet-connected users) by May 11, 2026.

**Final Tranche Requirement**
> I understand the final tranche requires submission of the Colosseum project link, GitHub repo, and AI coding subscription receipt.

## Final Checks Before Submit

- Add the direct GitHub repo URL if the form asks for repository/project link in addition to profile.
- Confirm the Crowdedness Score screenshot file is inside the shared Drive folder.
