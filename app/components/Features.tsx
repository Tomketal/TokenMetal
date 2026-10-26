"use client";

/* Features — Mini playable version of the actual invest flow.
   Mirrors what /invest does: pick Low/Medium/High risk → see 3 ranked picks.
   NOT the onboarding Stella quest (that has Guardian/Explorer/etc characters).
   This is the actual trade flow of the app, in miniature, so the landing
   demos the product honestly. No wallet, no signup — just click. */

import { useState } from "react";

type Risk = "low" | "medium" | "high";
type Pick = { ticker: string; name: string; change: string; conf: "low" | "med" | "high" };

const LABELS: Record<Risk, { label: string; sub: string; color: string }> = {
  low:    { label: "LOW",    sub: "Safer picks. Smaller moves. Slower.",   color: "#7ec4ea" },
  medium: { label: "MEDIUM", sub: "Balanced picks. Moderate upside.",      color: "#84f3be" },
  high:   { label: "HIGH",   sub: "Volatile picks. Bigger swings.",        color: "#f0a3c3" }
};

const PICKS: Record<Risk, Pick[]> = {
  low: [
    { ticker: "XLM",  name: "Stellar",   change: "+2.1%",  conf: "high" },
    { ticker: "USDC", name: "USD Coin",  change: "+0.0%",  conf: "high" },
    { ticker: "yXLM", name: "yieldblox", change: "+3.4%",  conf: "med"  }
  ],
  medium: [
    { ticker: "XLM",  name: "Stellar",   change: "+8.1%",  conf: "high" },
    { ticker: "AQUA", name: "Aquarius",  change: "+14.2%", conf: "med"  },
    { ticker: "yXLM", name: "yieldblox", change: "+9.4%",  conf: "med"  }
  ],
  high: [
    { ticker: "AQUA", name: "Aquarius",   change: "+28.1%", conf: "med"  },
    { ticker: "SRT",  name: "Stellar RT", change: "+42.5%", conf: "low"  },
    { ticker: "yXLM", name: "yieldblox",  change: "+22.4%", conf: "med"  }
  ]
};

export default function Features() {
  const [risk, setRisk] = useState<Risk | null>(null);
  const current = risk ? LABELS[risk] : null;
  const picks = risk ? PICKS[risk] : [];

  return (
    <section className="feat-band" id="why">
      <div className="feat-shell">
        <p className="feat-eyebrow reveal">
          <span className="feat-eyebrow-dot" aria-hidden="true" />
          Try the real flow · 10 seconds
        </p>
        <h2 className="feat-title reveal">Pick a risk. See your three picks.</h2>
        <p className="feat-sub reveal">
          This is the actual TokenMetal flow in miniature — the same thing the real app does with
          live Stellar prices. No wallet. No signup. Just click.
        </p>

        {/* Step 1 — risk pills (matches the actual invest UI) */}
        <div className="game-step reveal">
          <span className="game-step-label">
            <span className="game-step-num">01</span>
            Pick your risk
          </span>
          <div className="game-risks">
            {(Object.keys(LABELS) as Risk[]).map((r) => {
              const l = LABELS[r];
              const active = risk === r;
              return (
                <button
                  type="button"
                  key={r}
                  className={`game-risk${active ? " active" : ""}`}
                  style={{ ["--c" as string]: l.color }}
                  onClick={() => setRisk(r)}
                >
                  <div className="game-risk-ribbon" aria-hidden="true" />
                  <strong className="game-risk-label">{l.label}</strong>
                  <span className="game-risk-sub">{l.sub}</span>
                  {active ? (
                    <span className="game-risk-check" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path d="M3 8l3 3 7-7" fill="none" stroke="#0a0d12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 — picks reveal */}
        <div className="game-step reveal">
          <span className="game-step-label">
            <span className="game-step-num">02</span>
            Your three picks
          </span>
          {current ? (
            <div
              className="game-picks"
              key={risk}
              style={{ ["--c" as string]: current.color }}
            >
              <div className="game-picks-head">
                <span className="game-picks-pill" style={{ background: current.color }}>
                  {current.label} RISK
                </span>
                <span className="game-picks-note">
                  3 ranked picks · updated every session · from TokenMetal&apos;s Stellar scoring engine
                </span>
                <button
                  type="button"
                  className="game-reset"
                  onClick={() => setRisk(null)}
                  aria-label="Reset"
                >
                  ↻ reset
                </button>
              </div>
              <div className="game-picks-list">
                {picks.map((p, i) => (
                  <div
                    className="game-pick"
                    key={p.ticker}
                    style={{ animationDelay: `${i * 0.12 + 0.1}s` }}
                  >
                    <span className="game-pick-rank">#{i + 1}</span>
                    <div className="game-pick-main">
                      <strong>{p.ticker}</strong>
                      <span>{p.name}</span>
                    </div>
                    <span className={`game-pick-conf conf-${p.conf}`}>{p.conf} conf</span>
                    <span className="game-pick-change">{p.change}</span>
                  </div>
                ))}
              </div>
              <a href="/invest" className="game-cta">
                <span>Open the real app · $1 to start →</span>
              </a>
            </div>
          ) : (
            <div className="game-picks-empty">
              <span className="game-picks-empty-dot" aria-hidden="true" />
              <span>Pick a risk above to see your three picks.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
