import Image from "next/image";

const launchUrl = "/invest";
const tokenMetalXUrl = "https://x.com/TokenMetalapp";
const founderXUrl = "https://x.com/tomketal";
const githubUrl = "https://github.com/Tomketal/TokenMetal";

const gettingStartedBenefits = [
  {
    kicker: "01",
    title: "A short game to find your comfort with risk.",
    body: "Three mini-rounds with Stella, the guide. No wallet, no signup. Replayable any time."
  },
  {
    kicker: "02",
    title: "Three options explained in words you understand.",
    body: "Each pick shows its risk, its typical move, and a suggested stop loss. No charts, no jargon."
  },
  {
    kicker: "03",
    title: "Your activity and results in one place.",
    body: "Every purchase and sale, your profit and loss, downloadable as a CSV when you want."
  }
];

const howItWorksSteps = [
  {
    step: "01",
    title: "Find your style.",
    body: "Play the short Stella quiz or pick low, medium, or high risk."
  },
  {
    step: "02",
    title: "Set your amount and time.",
    body: "Choose how much of your USDC to use and how long you plan to hold."
  },
  {
    step: "03",
    title: "Review three options.",
    body: "See each token's risk, typical move, and a suggested stop loss level. Then pick one."
  },
  {
    step: "04",
    title: "Confirm and follow.",
    body: "Review the fee, confirm in your wallet, and sell with one tap whenever you want."
  }
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
  "Purchases settle in seconds and network fees cost a fraction of a cent.",
  "You keep your money in your own Stellar wallet.",
  "The fee and the purchase happen together in one transaction."
];

const stellarJudgeFacts = [
  "Trades are path payments on the Stellar DEX; the server only builds unsigned transactions and relays the signed one.",
  "The 2% fee is an extra payment operation in the same atomic transaction.",
  "Positions are recorded from the on-chain result, not from the quote.",
  "Recommendation engine uses Stellar market data, backtested on ~5 years of Stellar history (calibration + validation split).",
  "Wallets via Stellar Wallets Kit (Freighter, xBull, LOBSTR, Albedo and others)."
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

function TryButton({ variant = "primary", children = "Try TokenMetal" }: { variant?: "primary" | "secondary"; children?: React.ReactNode }) {
  return (
    <a className={`launch-button ${variant}`} href={launchUrl}>
      {children}
    </a>
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

export default function LandingPage() {
  return (
    <main className="landing-shell">
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
          <a className="social-link" href={tokenMetalXUrl} target="_blank" rel="noreferrer" aria-label="TokenMetal on X">
            <XIcon />
          </a>
          <TryButton>Try TokenMetal</TryButton>
        </nav>
      </header>

      {/* 1. HERO */}
      <section className="hero-section" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Live on Stellar · One USDC to start</p>
          <h1>Your first step into crypto, your way.</h1>
          <p className="hero-lede">
            Explore tokens and make your own decisions with a simple, customizable
            app built on Stellar.
          </p>
          <div className="hero-cta-row">
            <a className="launch-button hero-cta" href={launchUrl}>
              Try TokenMetal <span className="hero-cta-arrow" aria-hidden="true">→</span>
            </a>
            <a className="ghost-link" href="#how">See how it works</a>
          </div>
          <p className="hero-microcopy">
            Live on Stellar. Purchases use real USDC from your wallet. Start small: the minimum is 1 USDC.
          </p>
        </div>

        <aside className="config-panel" aria-label="TokenMetal product preview">
          <div className="config-screen balance-readout">
            <span>Your USDC balance</span>
            <strong>Example</strong>
          </div>

          <div className="config-screen metrics-readout">
            <div>
              <span>Invested</span>
              <strong>—</strong>
            </div>
            <div>
              <span>Open P/L</span>
              <strong>—</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>0</strong>
            </div>
            <div>
              <span>Closed</span>
              <strong>0</strong>
            </div>
          </div>

          <div className="config-module risk-module">
            <div className="config-screen mini-config-screen">
              <span>Risk profile</span>
              <strong>medium</strong>
            </div>
            <div className="risk-keypad" aria-label="Three risk levels">
              {["Low", "Medium", "High"].map((level, i) => (
                <span className={i === 1 ? "active" : ""} key={level}>
                  {level}
                </span>
              ))}
            </div>
          </div>

          <div className="config-dual">
            <div className="config-module">
              <div className="config-screen mini-config-screen">
                <span>Amount</span>
                <strong>35%</strong>
              </div>
              <div className="fader-preview" aria-hidden="true">
                <span />
                <i />
              </div>
              <div className="fader-labels">
                <span>5</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
            <div className="config-module">
              <div className="config-screen mini-config-screen">
                <span>Holding</span>
                <strong>1 month</strong>
              </div>
              <div className="fader-preview holding" aria-hidden="true">
                <span />
                <i />
              </div>
              <div className="fader-labels">
                <span>3d</span>
                <span>1w</span>
                <span>1m</span>
                <span>3m</span>
                <span>6m+</span>
              </div>
            </div>
          </div>

          <div className="config-cta">Review your three picks</div>
        </aside>
      </section>

      {/* 2. GETTING STARTED CAN BE SIMPLER */}
      <section className="content-band getting-started-band">
        <div className="section-heading narrow">
          <p className="eyebrow">Getting started can be simpler</p>
          <h2>You do not need to know everything to take the first step.</h2>
        </div>
        <div className="step-grid">
          {gettingStartedBenefits.map((b) => (
            <article className="step-card" key={b.kicker}>
              <span>{b.kicker}</span>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="content-band how-it-works-band" id="how">
        <div className="section-heading narrow">
          <p className="eyebrow">How it works</p>
          <h2>Four steps. Thirty seconds to the first one.</h2>
          <p>
            From your first visit to your first purchase, every step is explained in plain words.
            You decide, confirm, and keep control at all times.
          </p>
        </div>
        <div className="step-grid four-up">
          {howItWorksSteps.map((item) => (
            <article className="step-card" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4. MAKE IT YOURS */}
      <section className="content-band skin-band">
        <div className="section-heading narrow">
          <p className="eyebrow">Make it yours</p>
          <h2>Crypto can feel like you.</h2>
          <p>
            Choose a look that matches your style and make TokenMetal your own.
            Four skins, same product, four personalities.
          </p>
        </div>
        <div className="skin-gallery">
          {skins.map((s) => (
            <div className={`skin-card skin-card-${s.id}`} key={s.id}>
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
      </section>

      {/* 5. YOU STAY IN CONTROL */}
      <section className="content-band control-band">
        <div className="section-heading narrow">
          <p className="eyebrow">You stay in control</p>
          <h2>Your decisions, clear at every step.</h2>
        </div>
        <div className="control-grid">
          {controlFacts.map((fact) => (
            <div className="control-card" key={fact.title}>
              <h3>{fact.title}</h3>
              <p>{fact.body}</p>
            </div>
          ))}
        </div>
        <div className="control-note">
          <p>
            <strong>About the stop loss.</strong> Each option shows a suggested stop loss level,
            the price where you might consider selling to limit a loss.
            Automatic stop loss on Stellar is <em>coming soon</em>.
          </p>
          <p className="risk-warning">
            Token prices can rise or fall. Suggestions and risk tools do not guarantee that you will avoid losses.
          </p>
        </div>
      </section>

      {/* 6. BUILT ON STELLAR */}
      <section className="content-band stellar-band">
        <div className="section-heading narrow">
          <p className="eyebrow">Built on Stellar</p>
          <h2>A simpler experience on Stellar.</h2>
        </div>
        <div className="stellar-beginner">
          {stellarBeginnerFacts.map((fact) => (
            <div className="stellar-fact" key={fact}>
              <p>{fact}</p>
            </div>
          ))}
        </div>
        <details className="stellar-judges">
          <summary>Technical details for judges and developers</summary>
          <ul>
            {stellarJudgeFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </details>
      </section>

      {/* 7. FOUNDER */}
      <section className="founder-section">
        <div className="founder-photo">
          <Image
            src="/founder-tomas-mujica.jpg"
            alt="Tomás Mujica"
            width={640}
            height={512}
          />
        </div>
        <div className="founder-copy">
          <p className="eyebrow">Founder</p>
          <h2>Built by Tomás Mujica.</h2>
          <p>
            Ex-Base, Hedera, Algorand Foundation, OKX. Spent years helping protocols reach new users.
            TokenMetal is the product he wished existed when his non-crypto friends asked how to start.
          </p>
          <a className="founder-link" href={founderXUrl} target="_blank" rel="noreferrer">
            <XIcon />
            Follow Tomás on X
          </a>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="content-band faq-band">
        <div className="section-heading narrow">
          <p className="eyebrow">Frequently asked questions</p>
          <h2>Clear answers to common questions.</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <details className="faq-item" key={faq.q} open={i === 0}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. CLOSING */}
      <section className="final-cta">
        <p className="eyebrow">Live on Stellar · One USDC to start</p>
        <h2>Start exploring crypto your way.</h2>
        <p>Live on Stellar. Purchases use real USDC from your wallet. Start small: the minimum is 1 USDC.</p>
        <div className="hero-cta-row" style={{ justifyContent: "center" }}>
          <a className="launch-button hero-cta" href={launchUrl}>
            Try TokenMetal <span className="hero-cta-arrow" aria-hidden="true">→</span>
          </a>
          <a className="ghost-link" href="#how">See how it works</a>
        </div>
        <nav className="final-links" aria-label="TokenMetal links">
          <a href={tokenMetalXUrl} target="_blank" rel="noreferrer">X (@TokenMetalapp)</a>
          <span aria-hidden="true">·</span>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          <span aria-hidden="true">·</span>
          <a href={launchUrl}>Open the app</a>
        </nav>
      </section>
    </main>
  );
}
