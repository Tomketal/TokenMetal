"use client";

import type { CSSProperties, ReactElement } from "react";

type Skin = {
  code: string;
  name: string;
  blurb: string;
  render: () => ReactElement;
};

const noiseSvg =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)' opacity='0.6'/>
    </svg>`
  );

const previewBase: CSSProperties = {
  position: "relative",
  height: 100,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)"
};

function MetalPreview(): ReactElement {
  return (
    <div
      style={{
        ...previewBase,
        background:
          "linear-gradient(165deg, #d8dcde, #a5aaad 55%, #767a7d)"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(100deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px)",
          mixBlendMode: "overlay",
          opacity: 0.7
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 14,
          height: 32,
          borderRadius: 6,
          background: "#0a0f0d",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 8,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.35)"
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#5ef0b8",
            boxShadow: "0 0 10px #5ef0b8"
          }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            color: "#5ef0b8",
            letterSpacing: 1.5
          }}
        >
          TM://METAL
        </span>
      </div>
    </div>
  );
}

function GlassPreview(): ReactElement {
  return (
    <div
      style={{
        ...previewBase,
        background:
          "linear-gradient(165deg, rgba(255,235,200,0.55), rgba(220,195,160,0.35) 60%, rgba(255,230,195,0.25))",
        backdropFilter: "blur(6px) saturate(130%)",
        WebkitBackdropFilter: "blur(6px) saturate(130%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.1)"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.35)",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 54,
          height: 28,
          borderRadius: 999,
          background:
            "linear-gradient(165deg, #6ea0ff, #2d5fe0 60%, #163a9e)",
          border: "1px solid rgba(255,255,255,0.45)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.55), 0 6px 14px rgba(20,45,120,0.5)"
        }}
      />
    </div>
  );
}

function PlushPreview(): ReactElement {
  return (
    <div
      style={{
        ...previewBase,
        background:
          "radial-gradient(circle at 30% 30%, #ffdbea, #e989b5 60%, #a82d68)"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${noiseSvg}")`,
          backgroundSize: "120px 120px",
          mixBlendMode: "soft-light",
          opacity: 0.55,
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10
        }}
      >
        {["🐾", "🐾", "🐾"].map((p, i) => (
          <span
            key={i}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background:
                "linear-gradient(165deg, #ffe6f1, #f8b2d1 55%, #d26aa0)",
              border: "1px solid rgba(255,255,255,0.5)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(120,30,80,0.35)"
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function GridPreview(): ReactElement {
  return (
    <div
      style={{
        ...previewBase,
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,1)"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(237,240,236,0.1) 0 1px, transparent 1px 10px), repeating-linear-gradient(90deg, rgba(237,240,236,0.1) 0 1px, transparent 1px 10px)"
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 10,
          color: "#edf0ec",
          letterSpacing: 2
        }}
      >
        GRID-04
      </div>
    </div>
  );
}

const SKINS: Skin[] = [
  {
    code: "METAL-01",
    name: "Metal",
    blurb: "Chrome and mint terminal",
    render: MetalPreview
  },
  {
    code: "GLASS-02",
    name: "Glass",
    blurb: "Translucent gel buttons",
    render: GlassPreview
  },
  {
    code: "PLUSH-03",
    name: "Pink Plush",
    blurb: "WebGL fur. Mouse-reactive.",
    render: PlushPreview
  },
  {
    code: "GRID-04",
    name: "Grid",
    blurb: "Industrial terminal.",
    render: GridPreview
  }
];

export default function SkinShowcase(): ReactElement {
  return (
    <div className="tm-skin-showcase">
      <style>{`
        .tm-skin-showcase {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
        }
        @media (max-width: 980px) {
          .tm-skin-showcase { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .tm-skin-showcase { grid-template-columns: 1fr; }
        }
        .tm-skin-card {
          height: 280px;
          border-radius: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform 220ms cubic-bezier(.2,.9,.3,1), border-color 220ms ease, box-shadow 220ms ease;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
          color: #edf0ec;
        }
        .tm-skin-card:hover {
          transform: translateY(-6px);
          border-color: rgba(94, 240, 184, 0.55);
          box-shadow: 0 14px 36px rgba(0,0,0,0.4), 0 0 0 1px rgba(94,240,184,0.25), 0 0 28px rgba(94,240,184,0.2);
        }
        .tm-skin-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 2px;
          color: rgba(94, 240, 184, 0.9);
          text-transform: uppercase;
        }
        .tm-skin-name {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.2px;
          margin: 2px 0 4px;
        }
        .tm-skin-blurb {
          font-size: 13px;
          color: rgba(237,240,236,0.65);
          line-height: 1.4;
        }
      `}</style>
      {SKINS.map((skin) => {
        const Preview = skin.render;
        return (
          <div key={skin.code} className="tm-skin-card">
            <Preview />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="tm-skin-code">{skin.code}</div>
              <div className="tm-skin-name">{skin.name}</div>
              <div className="tm-skin-blurb">{skin.blurb}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
