"use client";

import Image from "next/image";
import Script from "next/script";
import dynamic from "next/dynamic";
import HowItWorksBento from "./components/HowItWorksBento";
import LiquidGlassButton from "./components/LiquidGlassButton";
import Features from "./components/Features";

// Dynamically imported WebGL backgrounds (no SSR).
const LiquidEther = dynamic(() => import("./invest/components/LiquidEther"), {
  ssr: false
});
const MoltenMetal = dynamic(() => import("./invest/components/MoltenMetal"), {
  ssr: false
});

// SkinShowcase is being built by another agent concurrently. If it isn't ready,
// we keep the existing skin-card markup as a safe inline fallback.
// (Delete this fallback and use `import SkinShowcase from "./components/SkinShowcase";`
//  once the real component lands.)

const launchUrl = "/invest";
const tokenMetalXUrl = "https://x.com/TokenMetalapp";
const founderXUrl = "https://x.com/tomketal";
const githubUrl = "https://github.com/Tomketal/TokenMetal";
const pitchDeckUrl = "/pitch-deck.html";

/* -------------------------------------------------------------------------- */
/*                                   Data                                     */
/* -------------------------------------------------------------------------- */

const painPoints = [
  {
    kicker: "01",
    title: "Hundreds of tokens, no starting point.",
    body: "You open any exchange and freeze. Where do you even begin?"
  },
  {
    kicker: "02",
    title: "Influencer picks you can't verify.",
    body: "Every voice shouts the next 100×. You buy one. It dumps 60% by lunch."
  },
  {
    kicker: "03",
    title: "Terminals built for pros.",
    body: "Order books, slippage, pool fees. None of it tells you what to actually buy."
  },
  {
    kicker: "04",
    title: "Risk you can't measure.",
    body: "Beginners don't know their risk tolerance until they lose. Too late to learn."
  }
];

const characters = [
  { chip: "Low risk",       name: "The Guardian",   body: "Protects the chest. Picks slow and steady." },
  { chip: "Medium risk",    name: "The Explorer",   body: "Takes the trail, but checks the map first." },
  { chip: "Medium-high",    name: "The Adventurer", body: "Walks into storms when the chest is worth it." },
  { chip: "High risk",      name: "The Berserker",  body: "Charges the cave. Sets their own limits." }
];

const numbers = [
  { n: "1",  unit: "USDC", label: "Minimum trade",       note: "Start small. Learn without risking rent money." },
  { n: "2",  unit: "%",    label: "Fee on buys",         note: "Zero on sells. No subscription. No lock-in." },
  { n: "30", unit: "s",    label: "Onboarding quest",    note: "From visit to character to picks." },
  { n: "5",  unit: "yrs",  label: "Backtested data",     note: "Calibration + validation on Stellar history." },
  { n: "4",  unit: "",     label: "Wallet integrations", note: "Freighter · xBull · LOBSTR · Albedo",         accent: true },
  { n: "0",  unit: "",     label: "Server-held keys",    note: "Signatures stay in your wallet, always.",     accent: true }
];

const skins = [
  { id: "metal", name: "Metal", code: "METAL-01", desc: "Chrome and mint. The original terminal." },
  { id: "glass", name: "Glass", code: "GLASS-02", desc: "Translucent champagne, gel jewel buttons." },
  { id: "plush", name: "Pink Plush", code: "PLUSH-03", desc: "WebGL fur. Soft, animated, surprising." },
  { id: "grid", name: "Grid", code: "GRID-04", desc: "Industrial terminal. Monochrome and precise." }
];

const controlFacts = [
  {
    title: "You review before you buy.",
    body: "You see exactly what you are buying, how much, and the 2% fee, before confirming."
  },
  {
    title: "You confirm every purchase in your own wallet.",
    body: "TokenMetal never holds your money or your keys. The fee and the purchase happen in one atomic transaction: both or neither."
  },
  {
    title: "You can sell at any time with one tap.",
    body: "No lock-in, no exit fee. Minimum 1 USDC per purchase so you can start small."
  }
];

const stellarBeginnerFacts = [
  {
    title: "Your money, your keys.",
    body: "TokenMetal never holds your money or your keys. Every purchase is confirmed in your own Stellar wallet."
  },
  {
    title: "The purchase and the fee happen together.",
    body: "Both go through in the same transaction. You never get charged without receiving your token, and the reverse can't happen either."
  },
  {
    title: "What you see is what really happened.",
    body: "Your activity shows the actual on-chain result of every trade — never a guess or a pre-trade estimate."
  }
];

const faqs = [
  {
    q: "Do I need crypto experience?",
    a: "No. A short game helps you pick a risk level, and each option is explained in plain words."
  },
  {
    q: "How does TokenMetal work?",
    a: "You choose risk, amount, and time. TokenMetal suggests three tokens. You pick one and confirm in your wallet."
  },
  {
    q: "Do I choose what to buy?",
    a: "Yes. Nothing is bought without your confirmation."
  },
  {
    q: "What does it cost?",
    a: "2% when you buy, nothing when you sell, no subscription. Stellar adds a tiny network fee, and adding a new token locks 0.5 XLM in your wallet that comes back when you sell all of it."
  },
  {
    q: "Can I lose money?",
    a: "Yes. Token prices go up and down. TokenMetal helps you understand the risk but cannot remove it."
  },
  {
    q: "Does it use real money?",
    a: "Yes. TokenMetal is live on Stellar mainnet, so every purchase uses real USDC from your own wallet. You can start with as little as 1 USDC. If you just want to look first, watch the walkthrough."
  },
  {
    q: "Which wallet do I need?",
    a: "Any Stellar wallet supported by Stellar Wallets Kit: Freighter, xBull, LOBSTR, Albedo, or others."
  },
  {
    q: "Which features are available now?",
    a: "Risk quiz, three picks, purchase, one-tap selling, Your Activity, and skins are all live. Automatic stop loss is coming soon."
  }
];

/* -------------------------------------------------------------------------- */
/*                                   Icons                                    */
/* -------------------------------------------------------------------------- */

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <path
        d="M4 10h11M11 6l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="x-icon">
      <path
        d="M13.76 10.23 21.18 2h-1.76l-6.45 7.15L7.83 2H1.9l7.78 10.82L1.9 21.45h1.76l6.8-7.55 5.43 7.55h5.93l-8.06-11.22Zm-2.41 2.68-.79-1.08L4.29 3.27h2.7l5.06 6.91.78 1.08 6.59 8.99h-2.7l-5.37-7.34Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Reveal animations                             */
/* -------------------------------------------------------------------------- */

const revealScript = `
(function(){
  if (typeof window === "undefined") return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function(el){ el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  els.forEach(function(el){ io.observe(el); });
})();
`;

/* -------------------------------------------------------------------------- */
/*                              Composed sections                             */
/* -------------------------------------------------------------------------- */

function StickyHeader() {
  return (
    <header className="site-header" aria-label="TokenMetal header">
      <a className="header-brand" href="#top" aria-label="TokenMetal home">
        <Image
          src="/tokenmetal-full-logo.png"
          alt="TokenMetal"
          width={2172}
          height={528}
          priority
        />
      </a>
      <nav className="header-actions" aria-label="Primary navigation">
        <a
          className="social-link"
          href={tokenMetalXUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="TokenMetal on X"
        >
          <XIcon />
        </a>
        <LiquidGlassButton href={launchUrl} variant="mint">
          Try TokenMetal
        </LiquidGlassButton>
      </nav>
    </header>
  );
}

function LivePill() {
  return (
    <div className="hero-live-dot reveal" aria-hidden="true">
      <span className="hero-live-pulse" />
      <span>Live on Stellar</span>
    </div>
  );
}

function TrustRow() {
  return (
    <p className="hero-trust-row reveal" aria-label="Why TokenMetal is safe to try">
      <span className="hero-trust-pill">
        <span className="hero-trust-dot" aria-hidden="true" />1 USDC minimum
      </span>
      <span className="hero-trust-pill">
        <span className="hero-trust-dot" aria-hidden="true" />Non-custodial
      </span>
      <span className="hero-trust-pill">
        <span className="hero-trust-dot" aria-hidden="true" />No signup
      </span>
    </p>
  );
}

function Hero() {
  return (
    <section
      className="hero-section hero-with-ether"
      id="top"
      style={{ position: "relative", overflow: "hidden", isolation: "isolate" }}
    >
      {/* LiquidEther full-bleed background */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none"
        }}
      >
        <LiquidEther
          colors={["#84f3be", "#5fb3e0", "#ff6f2e", "#b35fe0", "#ff8ab0"]}
          autoDemo
          autoIntensity={1.4}
          persistence={0.8}
          intensity={0.9}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="hero-copy" style={{ position: "relative", zIndex: 1 }}>
        <LivePill />
        <h1 className="reveal">Your first step into crypto, your way.</h1>
        <p className="hero-lede reveal">
          Explore tokens and make your own decisions with a simple, customizable
          app built on Stellar.
        </p>
        <div className="hero-cta-row reveal">
          <LiquidGlassButton
            href={launchUrl}
            variant="mint"
            size="lg"
            icon={<ArrowIcon />}
          >
            Try TokenMetal
          </LiquidGlassButton>
          <LiquidGlassButton href="#how" variant="glass" size="lg">
            See how it works
          </LiquidGlassButton>
        </div>
        <TrustRow />
        <p className="hero-microcopy reveal">
          Live on Stellar. Purchases use real USDC from your wallet. Start small:
          the minimum is 1 USDC.
        </p>
      </div>

      <div
        id="hero-mockup-slot"
        className="hero-mockup-slot reveal"
        style={{ position: "relative", zIndex: 1 }}
      >
        <span className="hero-mockup-label">LIVE · METAL SKIN</span>
        <Image
          src="/screenshots/invest-metal-desktop.png"
          alt="TokenMetal invest app preview — Metal skin"
          width={1440}
          height={900}
          className="hero-mockup-img"
          priority
        />
      </div>
    </section>
  );
}

function SectionHeading({
  kicker,
  title,
  body
}: {
  kicker: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="section-heading narrow reveal">
      <p className="eyebrow">{kicker}</p>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

// Problem, Characters, and ByTheNumbers were three heavy card-grid sections —
// now compacted into a single editorial WhyTokenMetal section (mint accents
// over dark, typographic, no solid-color cards).
function Problem() { return null; }
function Characters() { return null; }
function ByTheNumbers() { return null; }

function WhyTokenMetal() {
  return (
    <section className="content-band why-band" id="why">
      <SectionHeading
        kicker="Why TokenMetal exists"
        title="Simple, honest crypto for people new to this."
        body="Hundreds of tokens, influencer noise, pro-only terminals, risk you can't measure. We fixed all four — and we did it on Stellar so the numbers stay beginner-friendly."
      />

      <div className="why-stack">
        {/* 01 — The problem, as a tight 2×2 editorial list */}
        <div className="why-block reveal">
          <div className="why-block-head">
            <span className="why-block-num">01</span>
            <span className="why-block-title">The problem</span>
            <span className="why-block-side">What stops beginners</span>
          </div>
          <ul className="why-pain-list">
            {painPoints.map((p) => (
              <li key={p.kicker}>
                <strong>{p.title}</strong>
                <span>{p.body}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 02 — The 4 characters as a minimal horizontal strip */}
        <div className="why-block reveal">
          <div className="why-block-head">
            <span className="why-block-num">02</span>
            <span className="why-block-title">Your character</span>
            <span className="why-block-side">Played, not asked</span>
          </div>
          <div className="why-chars">
            {characters.map((c) => (
              <div className="why-char" key={c.name}>
                <span className="why-char-chip">{c.chip}</span>
                <strong>{c.name}</strong>
                <span className="why-char-body">{c.body}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 03 — The numbers as a big inline stat row (no cards) */}
        <div className="why-block reveal">
          <div className="why-block-head">
            <span className="why-block-num">03</span>
            <span className="why-block-title">By the numbers</span>
            <span className="why-block-side">Beginner-friendly maths</span>
          </div>
          <div className="why-stats">
            {numbers.map((m) => (
              <div className="why-stat" key={m.label}>
                <div className="why-stat-value">
                  <strong>{m.n}</strong>
                  {m.unit ? <span className="why-stat-unit">{m.unit}</span> : null}
                </div>
                <span className="why-stat-label">{m.label}</span>
                <span className="why-stat-note">{m.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="content-band how-it-works-band" id="how">
      <SectionHeading
        kicker="How it works"
        title="Four steps. Thirty seconds to the first one."
        body="From your first visit to your first purchase, every step is explained in plain words. You decide, confirm, and keep control at all times."
      />
      <div className="reveal">
        <HowItWorksBento />
      </div>
    </section>
  );
}

// Inline fallback for SkinShowcase (another agent is building the real one).
// Preserves the current skin-card markup exactly.
function SkinShowcase() {
  return (
    <div className="skin-gallery">
      {skins.map((s) => (
        <div className={`skin-card skin-card-${s.id} reveal`} key={s.id}>
          <div className="skin-preview" aria-hidden="true">
            <span className="skin-chip" />
            <span className="skin-screen" />
            <span className="skin-button" />
          </div>
          <div className="skin-meta">
            <span className="skin-code">{s.code}</span>
            <h3>{s.name}</h3>
            <p>{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skins — show the actual product in each skin as proof, not color swatches.
function Skins() {
  const previews = [
    { id: "metal", name: "Metal", src: "/screenshots/pitch/metal-mobile.png" },
    { id: "glass", name: "Glass", src: "/screenshots/pitch/glass-mobile.png" },
    { id: "plush", name: "Plush", src: "/screenshots/pitch/plush-mobile.png" },
    { id: "grid",  name: "Grid",  src: "/screenshots/pitch/grid-mobile.png" }
  ];
  return (
    <section className="content-band skin-band simple-skin">
      <div className="simple-skin-shell">
        <h2 className="reveal">Pick the look that feels like you.</h2>
        <p className="simple-skin-sub reveal">Four moods. One product. Your pick.</p>
        <div className="skin-preview-row reveal">
          {previews.map((p) => (
            <figure className="skin-preview" key={p.id}>
              <Image src={p.src} alt={`${p.name} skin`} width={390} height={844} />
              <figcaption>{p.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// Trust section — pair the headline with a real product screenshot as proof.
function Control() {
  return (
    <section className="content-band control-band simple-control">
      <div className="simple-control-shell control-with-proof">
        <div className="control-copy">
          <h2 className="reveal">
            Your money. Your keys. <span className="mint">Full stop.</span>
          </h2>
          <p className="simple-control-sub reveal">
            Every trade is confirmed in your own Stellar wallet. We never move your funds, and the activity you see is always what really happened on-chain.
          </p>
          <p className="simple-control-fine reveal">
            Live on Stellar mainnet. Automatic stop loss is coming soon.
          </p>
        </div>
        <figure className="control-proof reveal">
          <Image
            src="/screenshots/features/skin-metal-controls.png"
            alt="TokenMetal controls on the Metal skin"
            width={390}
            height={844}
            priority={false}
          />
        </figure>
      </div>
    </section>
  );
}

// Stellar merged into Control above — kept as a no-op so references stay valid.
function Stellar() { return null; }

function _LegacyStellar() {
  return (
    <section className="content-band stellar-band">
      <SectionHeading
        kicker="Built on Stellar"
        title="Three simple guarantees."
      />
      <div className="stellar-beginner">
        {stellarBeginnerFacts.map((fact) => (
          <div className="stellar-fact reveal" key={fact.title}>
            <h3>{fact.title}</h3>
            <p>{fact.body}</p>
          </div>
        ))}
      </div>
      {/* Full architecture + judge-facing details live in /pitch-deck.html */}
    </section>
  );
}

// Simple inline credit — one line, no card chrome.
function PoweredByCryptodays() {
  return (
    <section className="simple-powered reveal">
      <span className="simple-powered-tag">Powered by</span>
      <a
        className="simple-powered-link"
        href="https://www.cryptodays.xyz/"
        target="_blank"
        rel="noreferrer"
      >
        Cryptodays
        <span className="simple-powered-arrow" aria-hidden="true">↗</span>
      </a>
      <span className="simple-powered-sub">Web3 agency &amp; events across Spain.</span>
    </section>
  );
}

function FAQ() {
  return (
    <section className="content-band faq-band">
      <div className="band-orb band-orb-A" aria-hidden="true" />
      <div className="band-orb band-orb-B" aria-hidden="true" />
      <SectionHeading
        kicker="Frequently asked questions"
        title="Clear answers to common questions."
      />
      <div className="faq-list">
        {faqs.map((faq, i) => (
          <details className="faq-item reveal" key={faq.q} open={i === 0}>
            <summary>{faq.q}</summary>
            <p>{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FooterLinks() {
  return (
    <nav className="final-links" aria-label="TokenMetal links">
      <a href={pitchDeckUrl} target="_blank" rel="noreferrer">View pitch deck</a>
      <span aria-hidden="true">·</span>
      <a href={tokenMetalXUrl} target="_blank" rel="noreferrer">X (@TokenMetalapp)</a>
      <span aria-hidden="true">·</span>
      <a href={founderXUrl} target="_blank" rel="noreferrer">Founder</a>
      <span aria-hidden="true">·</span>
      <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
      <span aria-hidden="true">·</span>
      <a href={launchUrl}>Open the app</a>
    </nav>
  );
}

function FinalCTA() {
  return (
    <section
      className="final-cta reveal"
      style={{ position: "relative", overflow: "hidden", isolation: "isolate" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.7
        }}
      >
        <MoltenMetal
          colors={["#0e1c17", "#2f8f66", "#84f3be"]}
          speed={0.25}
          glow={1.4}
          opacity={0.9}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <p className="eyebrow">Live on Stellar · One USDC to start</p>
        <h2>Start exploring crypto your way.</h2>
        <p>
          Live on Stellar. Purchases use real USDC from your wallet. Start small:
          the minimum is 1 USDC.
        </p>
        <div className="hero-cta-row">
          <LiquidGlassButton
            href={launchUrl}
            variant="mint"
            size="lg"
            icon={<ArrowIcon />}
          >
            Try TokenMetal
          </LiquidGlassButton>
          <LiquidGlassButton href="#how" variant="glass" size="lg">
            See how it works
          </LiquidGlassButton>
        </div>
        <FooterLinks />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Landing shell                                */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <StickyHeader />
      <Hero />
      <Features />
      <HowItWorks />
      <Skins />
      <Control />
      <Stellar />
      <PoweredByCryptodays />
      <FAQ />
      <FinalCTA />
      <Script id="landing-reveal" strategy="afterInteractive">{revealScript}</Script>
    </main>
  );
}
