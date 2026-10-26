import type { CSSProperties } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
};

// Tiny SVG noise texture for subtle film grain. Encoded as a data URI so it
// ships inline and never triggers a network request.
const NOISE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)' opacity='0.9'/>
    </svg>`,
  );

export default function AnimatedHeroBackground({ className, style }: Props) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#0a0e12",
        ...style,
      }}
    >
      <style>{css}</style>

      <div className="tm-orb tm-orb-mint" />
      <div className="tm-orb tm-orb-cyan" />
      <div className="tm-orb tm-orb-orange" />
      <div className="tm-orb tm-orb-purple" />
      <div className="tm-orb tm-orb-pink" />

      {/* Vignette so edges fall off into pure black */}
      <div className="tm-vignette" />

      {/* Subtle grain for texture */}
      <div
        className="tm-grain"
        style={{ backgroundImage: `url("${NOISE_SVG}")` }}
      />
    </div>
  );
}

const css = `
  .tm-orb {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 800px;
    height: 800px;
    margin: -400px 0 0 -400px;
    border-radius: 50%;
    filter: blur(80px);
    will-change: transform, opacity;
    transform: translate3d(0, 0, 0);
  }

  .tm-orb-mint {
    background: radial-gradient(circle at 50% 50%, rgba(132, 243, 190, 0.25) 0%, rgba(132, 243, 190, 0) 65%);
  }
  .tm-orb-cyan {
    background: radial-gradient(circle at 50% 50%, rgba(95, 179, 224, 0.20) 0%, rgba(95, 179, 224, 0) 65%);
  }
  .tm-orb-orange {
    background: radial-gradient(circle at 50% 50%, rgba(255, 111, 46, 0.15) 0%, rgba(255, 111, 46, 0) 65%);
  }
  .tm-orb-purple {
    background: radial-gradient(circle at 50% 50%, rgba(179, 95, 224, 0.18) 0%, rgba(179, 95, 224, 0) 65%);
  }
  .tm-orb-pink {
    background: radial-gradient(circle at 50% 50%, rgba(255, 138, 176, 0.10) 0%, rgba(255, 138, 176, 0) 65%);
  }

  /* Static fallback positions (prefers-reduced-motion / no animation support) */
  .tm-orb-mint   { transform: translate3d(-28vw, -18vh, 0) scale(1.05); }
  .tm-orb-cyan   { transform: translate3d( 26vw, -22vh, 0) scale(0.95); }
  .tm-orb-orange { transform: translate3d( 18vw,  24vh, 0) scale(1.00); }
  .tm-orb-purple { transform: translate3d(-22vw,  20vh, 0) scale(1.10); }
  .tm-orb-pink   { transform: translate3d(  0vw,   0vh, 0) scale(0.90); }

  .tm-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba(10, 14, 18, 0) 40%, rgba(10, 14, 18, 0.75) 100%);
    pointer-events: none;
  }

  .tm-grain {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    mix-blend-mode: overlay;
    background-repeat: repeat;
    background-size: 160px 160px;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tm-orb-mint {
      animation: tm-drift-mint 26s ease-in-out infinite alternate;
    }
    .tm-orb-cyan {
      animation: tm-drift-cyan 32s ease-in-out infinite alternate;
    }
    .tm-orb-orange {
      animation: tm-drift-orange 24s ease-in-out infinite alternate;
    }
    .tm-orb-purple {
      animation: tm-drift-purple 29s ease-in-out infinite alternate;
    }
    .tm-orb-pink {
      animation: tm-drift-pink 22s ease-in-out infinite alternate;
    }

    @keyframes tm-drift-mint {
      0%   { transform: translate3d(-28vw, -18vh, 0) scale(1.05); }
      50%  { transform: translate3d(-10vw, -28vh, 0) scale(1.15); }
      100% { transform: translate3d(-32vw,  -6vh, 0) scale(0.95); }
    }
    @keyframes tm-drift-cyan {
      0%   { transform: translate3d( 26vw, -22vh, 0) scale(0.95); }
      50%  { transform: translate3d( 32vw,   4vh, 0) scale(1.10); }
      100% { transform: translate3d( 14vw, -30vh, 0) scale(1.00); }
    }
    @keyframes tm-drift-orange {
      0%   { transform: translate3d( 18vw,  24vh, 0) scale(1.00); }
      50%  { transform: translate3d(  4vw,  30vh, 0) scale(1.15); }
      100% { transform: translate3d( 28vw,  10vh, 0) scale(0.90); }
    }
    @keyframes tm-drift-purple {
      0%   { transform: translate3d(-22vw,  20vh, 0) scale(1.10); }
      50%  { transform: translate3d(-30vw,   2vh, 0) scale(0.95); }
      100% { transform: translate3d( -6vw,  28vh, 0) scale(1.20); }
    }
    @keyframes tm-drift-pink {
      0%   { transform: translate3d(  0vw,   0vh, 0) scale(0.90); }
      50%  { transform: translate3d( 12vw, -14vh, 0) scale(1.05); }
      100% { transform: translate3d(-14vw,  12vh, 0) scale(0.85); }
    }
  }
`;
