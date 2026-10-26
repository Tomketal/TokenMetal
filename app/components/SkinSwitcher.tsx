"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type SkinId = "metal" | "glass" | "plush" | "grid" | "cryptodays";

export const SKINS: { id: SkinId; name: string; edition: string; blurb: string }[] = [
  { id: "metal", name: "Metal", edition: "METAL-01", blurb: "Chrome and mint terminal" },
  { id: "glass", name: "Glass", edition: "GLASS-02", blurb: "Translucent gel buttons" },
  { id: "plush", name: "Pink Plush", edition: "PLUSH-03", blurb: "Soft fur, pearl keys" },
  { id: "grid", name: "Grid", edition: "GRID-04", blurb: "Industrial terminal" },
  { id: "cryptodays", name: "Cryptodays", edition: "CDAYS-05", blurb: "Violet education glow" }
];

const STORAGE_KEY = "tm-skin";

export function readSkinFromStorage(): SkinId {
  if (typeof window === "undefined") return "metal";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "glass" || v === "plush" || v === "grid" || v === "metal") return v;
  return "metal";
}

function applySkin(skin: SkinId) {
  document.documentElement.dataset.skin = skin;
}

export function useSkin(): [SkinId, (next: SkinId) => void] {
  const [skin, setSkinState] = useState<SkinId>("metal");

  useLayoutEffect(() => {
    const initial = readSkinFromStorage();
    setSkinState(initial);
    applySkin(initial);
  }, []);

  const setSkin = (next: SkinId) => {
    setSkinState(next);
    applySkin(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  };

  return [skin, setSkin];
}

export function SkinSwitcher({ skin, onChange }: { skin: SkinId; onChange: (next: SkinId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = SKINS.find((s) => s.id === skin) || SKINS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="skin-switcher-wrap" ref={ref}>
      <button
        type="button"
        className={`skin-switcher-button ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="skin-switcher-label">Skins</span>
        <span className="skin-switcher-current">{current.name}</span>
        <span className="skin-switcher-caret" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="skin-switcher-panel" role="menu" aria-label="Choose skin">
          <div className="skin-tile-grid">
            {SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={s.id === skin}
                className={`skin-tile skin-tile-${s.id} ${s.id === skin ? "selected" : ""}`}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <span className="skin-tile-preview" aria-hidden="true">
                  <span className="skin-tile-screen" />
                  <span className="skin-tile-button" />
                  <span className="skin-tile-slider" />
                </span>
                <span className="skin-tile-meta">
                  <span className="skin-tile-name">{s.name}</span>
                  <span className="skin-tile-edition">{s.edition}</span>
                  <span className="skin-tile-blurb">{s.blurb}</span>
                </span>
                {s.id === skin ? <span className="skin-tile-check" aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
