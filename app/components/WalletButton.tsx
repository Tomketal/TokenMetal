"use client";

import { useEffect, useRef, useState } from "react";
import { useStellarWallet } from "@/app/providers";

// Stellar wallet connect button (Freighter, xBull, Lobstr, ...). Keeps the
// markup and class names of the previous Privy button so existing styles apply.

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, connecting, connect, disconnect } = useStellarWallet();
  const connected = Boolean(address);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const label = address ? `Connected: ${shortAddress(address)}` : connecting ? "Connecting..." : "Connect wallet";

  return (
    <div className="privy-wallet-menu-wrap" ref={menuRef}>
      <button
        className={`wallet-placeholder privy-wallet-button ${connected ? "connected" : ""}`}
        type="button"
        onClick={() => {
          if (connected) {
            setMenuOpen((current) => !current);
            return;
          }
          void connect();
        }}
        disabled={connecting}
        title={connected ? "Wallet connected. Click for options." : "Connect a Stellar wallet"}
      >
        {label}
      </button>
      {connected && menuOpen ? (
        <div className="privy-wallet-menu" role="menu" aria-label="Account options">
          <button
            className="privy-wallet-menu-item"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
