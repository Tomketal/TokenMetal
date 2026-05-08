"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as usePrivySolanaWallets } from "@privy-io/react-auth/solana";
import { useWallet } from "@solana/wallet-adapter-react";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getIdentityLabel(user: ReturnType<typeof usePrivy>["user"]) {
  if (!user) return "Connected";
  if (user.wallet?.address) return shortAddress(user.wallet.address);
  if (user.email?.address) return user.email.address;
  if (user.twitter?.username) return `@${user.twitter.username}`;
  if (user.google?.email) return user.google.email;
  if (user.phone?.number) return user.phone.number;
  return "Connected";
}

export function PrivyLoginButton() {
  if (!privyAppId) {
    return (
      <button
        className="wallet-placeholder privy-wallet-button"
        type="button"
        disabled
        title="Set NEXT_PUBLIC_PRIVY_APP_ID to enable Privy."
      >
        Log In
      </button>
    );
  }

  return <PrivyLoginButtonInner />;
}

function PrivyLoginButtonInner() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets: privySolanaWallets } = usePrivySolanaWallets();
  const { publicKey, disconnect: disconnectWallet } = useWallet();
  const walletAdapterAddress = publicKey?.toBase58() || "";
  const privySessionWalletAddress = authenticated ? (privySolanaWallets[0]?.address || "") : "";
  const walletAddress = walletAdapterAddress || privySessionWalletAddress;
  const walletConnected = Boolean(walletAddress);
  const connected = Boolean(walletAdapterAddress) || authenticated;

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

  const label = useMemo(() => {
    if (connected) {
      const identity = walletConnected ? shortAddress(walletAddress) : getIdentityLabel(user);
      return `Connected: ${identity}`;
    }
    if (!ready) return "Loading...";
    return "Log In";
  }, [connected, ready, user, walletAddress, walletConnected]);

  async function disconnectAll() {
    setMenuOpen(false);
    if (privySolanaWallets.length > 0) {
      await Promise.allSettled(
        privySolanaWallets.map(async (wallet) => {
          try {
            await wallet.disconnect();
          } catch {
            // Ignore external connector disconnect failures and continue.
          }
        })
      );
    }
    if (walletAdapterAddress) {
      try {
        await disconnectWallet();
      } catch {
        // Ignore wallet disconnect failures and continue with auth logout.
      }
    }
    if (authenticated) {
      await logout();
    }
  }

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
          if (!ready) return;
          login();
        }}
        disabled={!ready && !connected}
        title={connected ? "Connected. Click for options." : ready ? "Log in with Privy" : "Privy is loading"}
      >
        {label}
      </button>
      {connected && menuOpen ? (
        <div className="privy-wallet-menu" role="menu" aria-label="Connection options">
          <button className="privy-wallet-menu-item" type="button" onClick={() => void disconnectAll()}>
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
