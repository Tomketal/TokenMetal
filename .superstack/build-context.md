{
  "stack": {
    "starter_repo": "create-solana-dapp style Next.js app",
    "framework": "Next.js App Router + TypeScript",
    "wallet": "Solana wallet adapter with Solflare first",
    "protocols": ["Nansen API", "Jupiter Swap API"],
    "skills_used": ["solana-new-main/skills/build/scaffold-project"],
    "mcps_recommended": ["helius-mcp", "dcspark-jupiter", "opensvm-dexscreener-mcp"]
  },
  "architecture": {
    "pattern": "Next.js + existing protocol integrations",
    "key_decisions": [
      "No custom Anchor program for MVP",
      "Recommendation, trade execution, and position tracking are separate modules",
      "Wallet signs Jupiter transactions client-side",
      "Local JSON store for hackathon position tracking"
    ]
  },
  "build_status": {
    "mvp_complete": false,
    "tests_passing": false,
    "devnet_deployed": false
  }
}
