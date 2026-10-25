"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { networkPassphrase, stellarNetwork } from "@/lib/stellar/network";

interface StellarWalletContextValue {
  address: string | null;
  network: typeof stellarNetwork;
  connecting: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
}

const StellarWalletContext = createContext<StellarWalletContextValue | null>(null);

// The kit touches `window` and registers web components, so it is loaded
// lazily in the browser instead of at module scope (which also runs on SSR).
let kitPromise: Promise<typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit> | null = null;

function loadKit() {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit }, { defaultModules }, { Networks }] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/modules/utils"),
      import("@creit.tech/stellar-wallets-kit/types")
    ]);
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: stellarNetwork === "testnet" ? Networks.TESTNET : Networks.PUBLIC
    });
    return StellarWalletsKit;
  })();
  return kitPromise;
}

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const kit = await loadKit();
      const { address: connected } = await kit.authModal();
      setAddress(connected);
      return connected;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const kit = await loadKit();
    await kit.disconnect();
    setAddress(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Connect a Stellar wallet first.");
      const kit = await loadKit();
      const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase, address });
      return signedTxXdr;
    },
    [address]
  );

  const value = useMemo(
    () => ({ address, network: stellarNetwork, connecting, connect, disconnect, signTransaction }),
    [address, connecting, connect, disconnect, signTransaction]
  );

  return <StellarWalletContext.Provider value={value}>{children}</StellarWalletContext.Provider>;
}

export function useStellarWallet() {
  const context = useContext(StellarWalletContext);
  if (!context) throw new Error("useStellarWallet must be used inside WalletProviders.");
  return context;
}
