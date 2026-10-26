"use client";

/* HowItWorksBento — finance-dashboard bento cards illustrating the 4-step
   TokenMetal flow with real data visualizations (gauge, growth %, bar chart,
   line chart). Pure SVG + CSS animations, no deps. */

export type BentoStep = {
  step: string;
  title: string;
  body: string;
  kind: "gauge" | "growth" | "picks" | "capital";
  size?: "wide" | "normal";
};

const STEPS: BentoStep[] = [
  {
    step: "01",
    title: "Find your style.",
    body: "Play the Stella quiz, discover your character, get your risk score.",
    kind: "gauge",
    size: "wide"
  },
  {
    step: "02",
    title: "Set your amount.",
    body: "Choose how much USDC to use and how long to hold.",
    kind: "growth"
  },
  {
    step: "03",
    title: "Review three options.",
    body: "Three picks, each with its typical move and suggested stop loss.",
    kind: "picks"
  },
  {
    step: "04",
    title: "Follow your capital, split by asset.",
    body: "Watch each token's contribution to your total, month by month, in Your Activity.",
    kind: "capital",
    size: "wide"
  }
];

/* ---------- Gauge: risk score semicircle (step 1) ---------- */

function GaugeDemo() {
  return (
    <div className="bento-demo bento-demo-gauge">
      <svg viewBox="0 0 160 100" className="bento-gauge-svg" aria-hidden="true">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <path d="M 20 90 A 60 60 0 0 1 140 90" stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M 20 90 A 60 60 0 0 1 140 90" stroke="url(#gaugeGrad)" strokeWidth="12" fill="none" strokeLinecap="round" className="bento-gauge-arc" />
        <circle cx="80" cy="90" r="4" fill="#fff" />
        <line x1="80" y1="90" x2="80" y2="40" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="bento-gauge-needle" />
      </svg>
      <div className="bento-gauge-value">
        <strong>69</strong>
        <span>Risk Score</span>
      </div>
      <div className="bento-gauge-chars">
        <div className="bento-gauge-char" style={{ background: "#c9ccd1" }} title="Guardian" />
        <div className="bento-gauge-char" style={{ background: "#facc15" }} title="Explorer" />
        <div className="bento-gauge-char active" style={{ background: "#fb923c" }} title="Adventurer" />
        <div className="bento-gauge-char" style={{ background: "#ef4444" }} title="Berserker" />
      </div>
    </div>
  );
}

/* ---------- Growth: amount + percent + mini bar chart (step 2) ---------- */

function GrowthDemo() {
  return (
    <div className="bento-demo bento-demo-growth">
      <div className="bento-growth-pct">
        <span className="bento-growth-arrow">↑</span>
        <strong>14.9%</strong>
      </div>
      <div className="bento-growth-amount">
        <span>Example upside</span>
        <strong>$1,244</strong>
      </div>
      <div className="bento-growth-bars" aria-hidden="true">
        {[42, 65, 48, 72, 55, 80, 62, 90, 70, 95].map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Picks: 3 tokens with ticker + % change (step 3) ---------- */

function PicksDemo() {
  const picks = [
    { ticker: "XLM", name: "Stellar", pct: "+8.1%", color: "#4ade80" },
    { ticker: "AQUA", name: "Aquarius", pct: "+14.2%", color: "#facc15" },
    { ticker: "yXLM", name: "yieldblox", pct: "+22.4%", color: "#fb923c" }
  ];
  return (
    <div className="bento-demo bento-demo-picks">
      {picks.map((p, i) => (
        <div className="bento-pick" key={p.ticker} style={{ animationDelay: `${i * 0.3}s` }}>
          <span className="bento-pick-dot" style={{ background: p.color }} />
          <span className="bento-pick-ticker">{p.ticker}</span>
          <span className="bento-pick-name">{p.name}</span>
          <span className="bento-pick-pct" style={{ color: p.color }}>{p.pct}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Capital: stacked-wave composition (step 4) — matches the
   "Net worth" card from the finance-bento reference. Four asset ribbons
   (USDC safe reserve + XLM + AQUA + yXLM) stacked over 10 months, big
   dot-matrix total, legend, and a floating snapshot tooltip. ---------- */

function CapitalDemo() {
  // Four asset series (relative units; scaled up so stack fills the chart).
  // USDC = safe reserve (shrinks slightly). Three picks grow month over month.
  const assets = [
    { key: "usdc", name: "USDC", color: "#84f3be", series: [34, 33, 32, 31, 30, 29, 28, 27, 26, 25] },
    { key: "xlm",  name: "XLM",  color: "#5fb3e0", series: [14, 17, 20, 22, 24, 26, 28, 30, 32, 34] },
    { key: "aqua", name: "AQUA", color: "#ffd958", series: [10, 12, 14, 16, 19, 22, 25, 27, 29, 31] },
    { key: "yxlm", name: "yXLM", color: "#ff8f4e", series: [ 6,  8, 10, 13, 16, 19, 22, 25, 28, 30] }
  ];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const W = 320, H = 180;
  const stepX = W / (months.length - 1);

  // Cumulative stack bottom-up — each row is the top edge of that asset's ribbon.
  const stacked = assets.reduce<number[][]>((acc, a, i) => {
    const prev = i === 0 ? new Array(months.length).fill(0) : acc[i - 1];
    acc.push(a.series.map((v, j) => prev[j] + v));
    return acc;
  }, []);
  const maxTotal = Math.max(...stacked[stacked.length - 1]);
  const toY = (v: number) => H - (v / maxTotal) * H * 0.85;

  // Smooth cubic bezier between adjacent points for the flowing-wave look.
  const smoothTop = (row: number[]) =>
    row.reduce((d, v, j) => {
      const x = j * stepX, y = toY(v);
      if (j === 0) return `M ${x} ${y}`;
      const px = (j - 1) * stepX, py = toY(row[j - 1]);
      return `${d} C ${px + stepX * 0.5} ${py}, ${x - stepX * 0.5} ${y}, ${x} ${y}`;
    }, "");
  const smoothBottomReverse = (row: number[]) => {
    // Walk points right-to-left so the subpath closes cleanly.
    const pts = row.map((v, j) => ({ x: j * stepX, y: toY(v) })).reverse();
    return pts.reduce((d, p, k) => {
      if (k === 0) return `L ${p.x} ${p.y}`;
      const prev = pts[k - 1];
      return `${d} C ${prev.x - stepX * 0.5} ${prev.y}, ${p.x + stepX * 0.5} ${p.y}, ${p.x} ${p.y}`;
    }, "");
  };

  const ribbons = assets.map((_, i) => {
    const top = smoothTop(stacked[i]);
    const bottom = i === 0
      ? ` L ${(months.length - 1) * stepX} ${H} L 0 ${H}`
      : ` ${smoothBottomReverse(stacked[i - 1])}`;
    return `${top}${bottom} Z`;
  });

  // Snapshot pills — small labels above specific months
  const pills = [
    { idx: 0, label: "$8K" },
    { idx: 4, label: "$10K" },
    { idx: 9, label: "$12K" }
  ];

  // July cursor + tooltip
  const snapIdx = 6;
  const snapshot = assets.map((a) => ({ name: a.name, color: a.color, value: a.series[snapIdx] * 100 }));
  const snapTotal = snapshot.reduce((sum, s) => sum + s.value, 0);
  const snapLeftPct = (snapIdx / (months.length - 1)) * 100;
  const tooltipOnRight = snapLeftPct < 50;

  // Big total = latest month
  const latestTotal = stacked[stacked.length - 1][months.length - 1] * 100;
  const firstTotal = stacked[stacked.length - 1][0] * 100;
  const growthPct = (((latestTotal - firstTotal) / firstTotal) * 100).toFixed(1);

  return (
    <div className="bento-demo bento-demo-capital">
      <div className="capital-head">
        <div>
          <span className="capital-label">Your capital</span>
          <strong className="capital-total">${latestTotal.toLocaleString("en-US")}</strong>
          <div className="capital-growth">
            <span className="capital-growth-pct">↑ {growthPct}%</span>
            <span className="capital-growth-note">+${(latestTotal - firstTotal).toLocaleString("en-US")} this year</span>
          </div>
        </div>
        <div className="capital-legend">
          {assets.map((a) => (
            <span className="capital-legend-item" key={a.key}>
              <span className="capital-legend-dot" style={{ background: a.color }} />
              {a.name}
            </span>
          ))}
        </div>
      </div>

      <div className="capital-chart">
        {pills.map((p) => {
          const isFirst = p.idx === 0;
          const isLast = p.idx === months.length - 1;
          const edgeClass = isFirst ? " capital-pill-first" : isLast ? " capital-pill-last" : "";
          return (
            <span
              key={p.idx}
              className={`capital-pill${edgeClass}`}
              style={{ left: `${(p.idx / (months.length - 1)) * 100}%` }}
            >
              {p.label}
            </span>
          );
        })}

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="capital-svg" aria-hidden="true">
          <defs>
            {assets.map((a) => (
              <linearGradient key={a.key} id={`capGrad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={a.color} stopOpacity="0.45" />
              </linearGradient>
            ))}
          </defs>
          {ribbons.map((d, i) => (
            <path
              key={assets[i].key}
              d={d}
              fill={`url(#capGrad-${assets[i].key})`}
              className="capital-ribbon"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
          <line
            x1={snapIdx * stepX}
            y1="0"
            x2={snapIdx * stepX}
            y2={H}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        </svg>

        <div
          className={`capital-tooltip ${tooltipOnRight ? "capital-tooltip-right" : "capital-tooltip-left"}`}
          style={{ left: `${snapLeftPct}%` }}
        >
          <div className="capital-tooltip-head">
            <span>{months[snapIdx]}</span>
            <span className="capital-tooltip-chev">▸</span>
          </div>
          {snapshot.map((s) => (
            <div className="capital-tooltip-row" key={s.name}>
              <span className="capital-tooltip-dot" style={{ background: s.color }} />
              <span className="capital-tooltip-name">{s.name}</span>
              <span className="capital-tooltip-value">${s.value.toLocaleString("en-US")}</span>
            </div>
          ))}
          <div className="capital-tooltip-total">
            <span>Total</span>
            <span>${snapTotal.toLocaleString("en-US")}</span>
          </div>
        </div>
      </div>

      <div className="capital-months">
        {months.map((m, i) => (
          <span key={m} style={{ gridColumn: i + 1 }}>{i % 3 === 0 ? m : ""}</span>
        ))}
      </div>
    </div>
  );
}

const demos: Record<BentoStep["kind"], React.ReactNode> = {
  gauge: <GaugeDemo />,
  growth: <GrowthDemo />,
  picks: <PicksDemo />,
  capital: <CapitalDemo />
};

export default function HowItWorksBento() {
  return (
    <div className="bento-grid">
      {STEPS.map((s) => (
        <article className={`bento-card bento-card-${s.kind} ${s.size === "wide" ? "bento-wide" : ""}`} key={s.step}>
          <div className="bento-visual">{demos[s.kind]}</div>
          <div className="bento-copy">
            <span className="bento-step">{s.step}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
