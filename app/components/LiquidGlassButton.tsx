"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactElement
} from "react";

interface LiquidGlassButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "mint" | "glass" | "orange";
  icon?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}

type GlowCSS = CSSProperties & {
  "--glow-x"?: string;
  "--glow-y"?: string;
};

const VARIANT_STYLES: Record<
  NonNullable<LiquidGlassButtonProps["variant"]>,
  { background: string; color: string; glow: string; rim: string }
> = {
  mint: {
    background:
      "linear-gradient(165deg, rgba(190,255,230,0.95) 0%, rgba(120,230,195,0.9) 55%, rgba(70,195,160,0.9) 100%)",
    color: "#0a1512",
    glow: "rgba(255,255,255,0.75)",
    rim: "rgba(255,255,255,0.55)"
  },
  glass: {
    background:
      "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.08) 100%)",
    color: "#edf0ec",
    glow: "rgba(255,255,255,0.6)",
    rim: "rgba(255,255,255,0.4)"
  },
  orange: {
    background:
      "linear-gradient(165deg, rgba(255,185,120,0.95) 0%, rgba(255,135,60,0.95) 55%, rgba(220,90,25,0.95) 100%)",
    color: "#ffffff",
    glow: "rgba(255,235,210,0.75)",
    rim: "rgba(255,255,255,0.5)"
  }
};

const FILTER_ID = "liquid-glass-btn-refract";
const SVG_HOST_ID = "liquid-glass-btn-refract-host";

// Radial-gradient normal map encoded as data URI. R + G channels sweep across
// the image so feDisplacementMap can read them as x/y displacement vectors to
// produce an outward-bending refraction at the rim.
const DISPLACEMENT_MAP =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="rx" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgb(128,128,128)"/>
          <stop offset="55%" stop-color="rgb(128,128,128)"/>
          <stop offset="100%" stop-color="rgb(255,0,128)"/>
        </radialGradient>
        <radialGradient id="ry" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgb(128,128,128)"/>
          <stop offset="55%" stop-color="rgb(128,128,128)"/>
          <stop offset="100%" stop-color="rgb(0,255,128)"/>
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="rgb(128,128,128)"/>
      <rect width="200" height="200" fill="url(#rx)" style="mix-blend-mode:screen"/>
      <rect width="200" height="200" fill="url(#ry)" style="mix-blend-mode:screen"/>
    </svg>`
  );

function ensureFilterInjected(): () => void {
  if (typeof document === "undefined") return () => {};
  const existing = document.getElementById(SVG_HOST_ID);
  if (existing) {
    const prev = Number(existing.getAttribute("data-refs") ?? "0");
    existing.setAttribute("data-refs", String(prev + 1));
    return () => {
      const host = document.getElementById(SVG_HOST_ID);
      if (!host) return;
      const refs = Number(host.getAttribute("data-refs") ?? "1") - 1;
      if (refs <= 0) host.remove();
      else host.setAttribute("data-refs", String(refs));
    };
  }
  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.setAttribute("id", SVG_HOST_ID);
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("focusable", "false");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.setAttribute("data-refs", "1");
  host.style.position = "absolute";
  host.style.width = "0";
  host.style.height = "0";
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.innerHTML = `
    <defs>
      <filter id="${FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="smoothed"/>
        <feImage href="${DISPLACEMENT_MAP}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="dispMap"/>
        <feDisplacementMap in="smoothed" in2="dispMap" scale="26" xChannelSelector="R" yChannelSelector="G" result="bent"/>
        <feDisplacementMap in="bent" in2="dispMap" scale="30" xChannelSelector="R" yChannelSelector="G" result="bentR"/>
        <feColorMatrix in="bentR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanR"/>
        <feDisplacementMap in="bent" in2="dispMap" scale="26" xChannelSelector="R" yChannelSelector="G" result="bentG"/>
        <feColorMatrix in="bentG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanG"/>
        <feDisplacementMap in="bent" in2="dispMap" scale="20" xChannelSelector="R" yChannelSelector="G" result="bentB"/>
        <feColorMatrix in="bentB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chanB"/>
        <feBlend in="chanR" in2="chanG" mode="screen" result="rg"/>
        <feBlend in="rg" in2="chanB" mode="screen" result="rgb"/>
        <feComponentTransfer in="rgb">
          <feFuncR type="table" tableValues="0 0.1 0.55 0.9 1.08"/>
          <feFuncG type="table" tableValues="0 0.1 0.55 0.9 1.08"/>
          <feFuncB type="table" tableValues="0 0.1 0.55 0.9 1.1"/>
        </feComponentTransfer>
      </filter>
    </defs>
  `;
  document.body.appendChild(host);
  return () => {
    const h = document.getElementById(SVG_HOST_ID);
    if (!h) return;
    const refs = Number(h.getAttribute("data-refs") ?? "1") - 1;
    if (refs <= 0) h.remove();
    else h.setAttribute("data-refs", String(refs));
  };
}

export default function LiquidGlassButton({
  children,
  href,
  onClick,
  variant = "glass",
  icon,
  size = "md",
  className
}: LiquidGlassButtonProps): ReactElement {
  const [glow, setGlow] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => ensureFilterInjected(), []);

  const v = VARIANT_STYLES[variant];

  const padV = size === "lg" ? 18 : 13;
  const padH = size === "lg" ? 32 : 22;
  const fontSize = size === "lg" ? 17 : 14.5;

  const scale = active ? 0.97 : hovered ? 1.02 : 1;

  const baseStyle: GlowCSS = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: `${padV}px ${padH}px`,
    fontSize,
    fontWeight: 600,
    letterSpacing: 0.2,
    lineHeight: 1,
    color: v.color,
    border: `1.5px solid ${v.rim}`,
    borderRadius: 999,
    boxShadow: active
      ? `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.35)`
      : `inset 0 1.2px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.12), 0 10px 28px rgba(0,0,0,0.28)`,
    cursor: "pointer",
    userSelect: "none",
    textDecoration: "none",
    transform: `scale(${scale})`,
    transition:
      "transform 160ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms ease, border-color 220ms ease",
    overflow: "hidden",
    isolation: "isolate",
    background: "transparent",
    "--glow-x": `${glow.x}%`,
    "--glow-y": `${glow.y}%`
  };

  // Refraction layer — pulls the backdrop behind the button through the SVG
  // displacement filter, giving a real optical bend + RGB fringe. Sits behind
  // the colored background tint so the variant hue still reads clearly.
  const refractionLayer: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    borderRadius: "inherit",
    backdropFilter: `url(#${FILTER_ID}) blur(2px) saturate(140%)`,
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
    zIndex: 0
  };

  const tintLayer: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    borderRadius: "inherit",
    background: v.background,
    opacity: variant === "glass" ? 0.6 : 0.92,
    zIndex: 0
  };

  const glowOverlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    borderRadius: "inherit",
    background: `radial-gradient(circle at var(--glow-x) var(--glow-y), ${v.glow} 0%, rgba(255,255,255,0) 55%)`,
    opacity: hovered ? 0.55 : 0.3,
    transition: "opacity 220ms ease",
    mixBlendMode: "screen",
    zIndex: 0
  };

  const topHighlight: CSSProperties = {
    position: "absolute",
    top: 0,
    left: "6%",
    right: "6%",
    height: "40%",
    pointerEvents: "none",
    borderRadius: "inherit",
    background:
      "linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0) 100%)",
    opacity: 0.9,
    zIndex: 0
  };

  const contentStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    zIndex: 1
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlow({ x, y });
  };

  const sharedHandlers = {
    onPointerMove: handlePointerMove,
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => {
      setHovered(false);
      setActive(false);
    },
    onPointerDown: () => setActive(true),
    onPointerUp: () => setActive(false)
  };

  const inner = (
    <>
      <span style={refractionLayer} aria-hidden />
      <span style={tintLayer} aria-hidden />
      <span style={topHighlight} aria-hidden />
      <span style={glowOverlayStyle} aria-hidden />
      <span style={contentStyle}>
        <span>{children}</span>
        {icon ? <span style={{ display: "inline-flex" }}>{icon}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className} style={baseStyle} {...sharedHandlers}>
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={baseStyle}
      {...sharedHandlers}
    >
      {inner}
    </button>
  );
}
