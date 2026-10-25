import Image from "next/image";

const launchUrl = "https://token-letal.vercel.app/";
const tokenMetalXUrl = "https://x.com/TokenMetalapp";
const founderXUrl = "https://x.com/tomketal";

const painPoints = [
  "Hundreds of tokens with no clear starting point",
  "Research scattered across dashboards, posts, and group chats",
  "Influencer noise that makes conviction feel impossible",
  "Bad first trades caused by unclear sizing and rushed swaps",
  "Crypto investing interfaces built for experts, not first-time investors"
];

const threeSteps = [
  {
    step: "01",
    title: "Choose your profile",
    body: "Set your risk level, USDC allocation, and time horizon in plain language."
  },
  {
    step: "02",
    title: "Get ranked options",
    body: "Review three clear picks with reasons based on expert market insights."
  },
  {
    step: "03",
    title: "Invest in one flow",
    body: "Confirm the amount, approve once, and we handle the trade."
  }
];

const demoFlow = [
  "Sign in with email or Google",
  "Set risk, amount, and how long you want to invest",
  "Review today's picks",
  "Confirm your purchase",
  "Track your investments live"
];

const trustSignals = [
  "Expert insights: trading activity, popularity, and what top investors are buying",
  "Every trade confirmed by you — no surprises",
  "One-tap trades, fully in your control",
  "Live and ready",
  "Sign in with email, Google, or wallet",
  "Built for first-time crypto investors"
];

function LaunchButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <a className={`launch-button ${variant}`} href={launchUrl} target="_blank" rel="noreferrer">
      Launch the app
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
      <header className="site-header" aria-label="Token Metal header">
        <a className="header-brand" href="#top" aria-label="Token Metal home">
          <Image
            src="/tokenmetal-full-logo.png"
            alt="Token Metal"
            width={2172}
            height={528}
            priority
          />
        </a>
        <nav className="header-actions" aria-label="Primary navigation">
          <a className="social-link" href={tokenMetalXUrl} target="_blank" rel="noreferrer" aria-label="Token Metal on X">
            <XIcon />
          </a>
          <LaunchButton />
        </nav>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Live and ready</p>
          <h1>Stellar investing made easy.</h1>
          <p className="hero-lede">
            Token Metal turns crypto investing into a guided three-step flow for beginners:
            choose your profile, review today's picks, and invest with one confirmation.
          </p>
          <div className="hero-actions">
            <LaunchButton />
            <a className="ghost-link" href="#flow">
              See the flow
            </a>
          </div>
          <div className="hero-stat-strip" aria-label="Token Metal summary">
            <span>Three inputs in</span>
            <strong>One confident trade out</strong>
            <span>Expert insights + one-tap trades</span>
          </div>
        </div>

        <aside className="config-panel" aria-label="Token Metal configuration panel preview">
          <div className="config-screen balance-readout">
            <span>Total USDC balance</span>
            <strong>2340 USDC</strong>
          </div>

          <div className="config-screen metrics-readout">
            <div>
              <span>Invested USDC</span>
              <strong>234 USDC</strong>
            </div>
            <div>
              <span>Open PnL</span>
              <strong>$500</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>4</strong>
            </div>
            <div>
              <span>Closed</span>
              <strong>3</strong>
            </div>
          </div>

          <div className="config-module risk-module">
            <div className="config-screen mini-config-screen">
              <span>Risk profile</span>
              <strong>medium high</strong>
            </div>
            <div className="risk-keypad" aria-label="Risk level set to 5">
              {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                <span className={level === 5 ? "active" : ""} key={level}>
                  {level}
                </span>
              ))}
            </div>
          </div>

          <div className="config-dual">
            <div className="config-module">
              <div className="config-screen mini-config-screen">
                <span>Capital</span>
                <strong>10%</strong>
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
                <strong>1 week</strong>
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

          <div className="config-cta">Get opportunities</div>
        </aside>
      </section>

      <section className="content-band problem-band" id="problem">
        <div className="section-heading">
          <p className="eyebrow">The beginner problem</p>
          <h2>First-time Stellar investors are asked to act like pros before their first trade.</h2>
        </div>
        <div className="problem-grid">
          {painPoints.map((point) => (
            <div className="metal-tile" key={point}>
              <span />
              <p>{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="content-band solution-band">
        <div className="section-heading narrow">
          <p className="eyebrow">The Token Metal flow</p>
          <h2>Three inputs in, one confident trade out.</h2>
          <p>
            Token Metal replaces research overload with a guided recommendation and execution path built
            around how beginners actually make decisions.
          </p>
        </div>
        <div className="step-grid">
          {threeSteps.map((item) => (
            <article className="step-card" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-flow" id="flow">
        <div className="terminal-panel flow-panel">
          <div className="section-heading">
            <p className="eyebrow">Product demo flow</p>
            <h2>From sign-in to live investment tracking.</h2>
          </div>
          <ol className="flow-list">
            {demoFlow.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="content-band trust-band">
        <div className="section-heading narrow">
          <p className="eyebrow">Trust and data</p>
          <h2>Guided picks powered by expert market data.</h2>
        </div>
        <div className="trust-grid">
          {trustSignals.map((signal) => (
            <div className="trust-chip" key={signal}>
              {signal}
            </div>
          ))}
        </div>
      </section>

      <section className="commission-section">
        <div>
          <p className="eyebrow">Transparent monetization</p>
          <h2>Simple pricing for a simple first trade.</h2>
        </div>
        <p>
          Token Metal charges a 2% convenience fee only when you buy. No subscription. No fee when you sell.
        </p>
      </section>

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
            Tomás focuses on Web3 growth and distribution, with experience working with Base, Hedera,
            Algorand Foundation, and OKX. Token Metal brings that go-to-market lens into a product built
            to help new users start crypto investing with more confidence.
          </p>
          <a className="founder-link" href={founderXUrl} target="_blank" rel="noreferrer">
            <XIcon />
            Follow Tomás on X
          </a>
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Live MVP</p>
        <h2>Ready for your first guided investment?</h2>
        <p>Sign in, set your profile, review three picks, and invest in one flow.</p>
        <LaunchButton />
      </section>
    </main>
  );
}
