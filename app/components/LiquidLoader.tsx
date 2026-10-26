"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement
} from "react";

interface LiquidLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

// TokenMetal brand palette — left-to-right across the 7 bars.
// Each entry is [bottom (deep), top (bright), glow].
const BAR_COLORS: Array<[string, string, string]> = [
  // mint
  ["#2fb380", "#9df0cc", "rgba(90,230,180,0.55)"],
  // cyan
  ["#1f8aa8", "#8ee6ff", "rgba(120,220,255,0.55)"],
  // gold
  ["#b8860b", "#ffe28a", "rgba(255,210,110,0.55)"],
  // orange
  ["#c6511d", "#ffb27a", "rgba(255,160,90,0.55)"],
  // raspberry
  ["#a01e5a", "#ff8ab8", "rgba(255,120,170,0.55)"],
  // purple
  ["#5e2fb0", "#c7a4ff", "rgba(180,140,255,0.55)"],
  // pink
  ["#c33ea0", "#ffb0e2", "rgba(255,170,230,0.55)"]
];

const BAR_COUNT = 7;

const SIZE_MAP: Record<
  NonNullable<LiquidLoaderProps["size"]>,
  { barW: number; gap: number; maxH: number; dot: number; baseDot: number }
> = {
  sm: { barW: 20, gap: 6, maxH: 44, dot: 10, baseDot: 6 },
  md: { barW: 40, gap: 10, maxH: 80, dot: 18, baseDot: 10 },
  lg: { barW: 56, gap: 14, maxH: 112, dot: 24, baseDot: 14 }
};

export default function LiquidLoader({
  size = "md",
  className,
  style
}: LiquidLoaderProps): ReactElement {
  const [heights, setHeights] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0)
  );
  const [droplets, setDroplets] = useState<boolean[]>(() =>
    new Array(BAR_COUNT).fill(false)
  );
  const [shimmer, setShimmer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(prev =>
        prev.map((_, i) => {
          const delay = i * 0.8;
          const time = Date.now() * 0.001;
          const wave = Math.sin(time + delay) + Math.sin(time * 4 + delay) * 0.15;
          return 80 * wave;
        })
      );
      setDroplets(prev =>
        prev.map((_, i) => {
          const delay = i * 0.8;
          const time = Date.now() * 0.001;
          return Math.sin(time + delay) > 0.8;
        })
      );
      setShimmer(((Date.now() * 0.001) % 2) - 1);
    }, 32);
    return () => clearInterval(interval);
  }, []);

  const dims = SIZE_MAP[size];
  const scale = dims.maxH / 80; // normalize the 0..80 wave output to size

  const containerStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: dims.gap,
    height: dims.maxH * 2 + dims.dot * 2,
    padding: `${dims.dot}px ${dims.gap}px`,
    ...style
  };

  return (
    <div
      className={className}
      style={containerStyle}
      role="status"
      aria-label="Loading"
    >
      {BAR_COLORS.map((c, i) => {
        const raw = heights[i] ?? 0;
        const signedH = raw * scale;
        const absH = Math.max(2, Math.abs(signedH));
        const flipped = signedH < 0;
        const [bottom, top, glow] = c;
        const peakVisible = droplets[i] ?? false;

        const columnStyle: CSSProperties = {
          position: "relative",
          width: dims.barW,
          height: dims.maxH,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center"
        };

        const barWrapperStyle: CSSProperties = {
          position: "relative",
          width: dims.barW,
          height: absH,
          transform: flipped ? "scaleY(-1)" : "scaleY(1)",
          transformOrigin: "bottom center",
          transition: "height 32ms linear"
        };

        const barStyle: CSSProperties = {
          position: "absolute",
          inset: 0,
          borderRadius: dims.barW / 2,
          background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
          boxShadow: `0 0 ${dims.barW * 0.6}px ${glow}, inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 6px rgba(0,0,0,0.25)`,
          overflow: "hidden"
        };

        // Internal moving wave crest — surface tension at the top of the bar.
        const surfaceStyle: CSSProperties = {
          position: "absolute",
          left: "-10%",
          right: "-10%",
          top: 0,
          height: "40%",
          background: `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)`,
          transform: `translateY(${Math.sin(Date.now() * 0.003 + i) * 4}px)`,
          pointerEvents: "none"
        };

        // Shimmer — a soft diagonal highlight sweeping horizontally.
        const shimmerStyle: CSSProperties = {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background:
            "linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 70%)",
          transform: `translateX(${shimmer * 100}%)`,
          pointerEvents: "none",
          mixBlendMode: "screen"
        };

        // Droplet at the top of the wave peak — appears when the bar's wave
        // value exceeds the droplet threshold.
        const peakDotStyle: CSSProperties = {
          position: "absolute",
          left: "50%",
          bottom: `calc(100% + ${dims.dot * 0.3}px)`,
          width: dims.dot,
          height: dims.dot,
          marginLeft: -dims.dot / 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${top} 55%, ${bottom} 100%)`,
          boxShadow: `0 0 ${dims.dot}px ${glow}`,
          opacity: peakVisible ? 1 : 0,
          transform: peakVisible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 220ms ease, transform 220ms ease",
          pointerEvents: "none"
        };

        // Base droplet — smaller permanent dot at the bar's foot.
        const baseDotStyle: CSSProperties = {
          position: "absolute",
          left: "50%",
          top: `calc(100% + ${dims.baseDot * 0.4}px)`,
          width: dims.baseDot,
          height: dims.baseDot,
          marginLeft: -dims.baseDot / 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 35%, ${top} 0%, ${bottom} 100%)`,
          boxShadow: `0 0 ${dims.baseDot * 1.4}px ${glow}`,
          opacity: 0.9,
          pointerEvents: "none"
        };

        return (
          <div key={i} style={columnStyle} aria-hidden>
            <div style={barWrapperStyle}>
              <div style={barStyle}>
                <div style={surfaceStyle} />
                <div style={shimmerStyle} />
              </div>
              <div style={peakDotStyle} />
              <div style={baseDotStyle} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
