"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import { DEFAULT_SOLANA_RPC_URL } from "@/lib/config";

const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;
const privyWalletList = [
  "solflare",
  "phantom",
  "backpack",
  "detected_solana_wallets",
  "wallet_connect_qr_solana"
] as const;
const privySolanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false
});

function resolveWalletNetwork(input: string): WalletAdapterNetwork {
  if (input === "devnet") return WalletAdapterNetwork.Devnet;
  if (input === "testnet") return WalletAdapterNetwork.Testnet;
  return WalletAdapterNetwork.Mainnet;
}

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => {
    const network = resolveWalletNetwork(cluster);
    return [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })];
  }, []);

  const walletTree = (
    <ConnectionProvider endpoint={rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={(error) => console.error("Wallet adapter error:", error)}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );

  if (!privyAppId) {
    return walletTree;
  }

  const privyProviderProps = privyClientId
    ? { appId: privyAppId, clientId: privyClientId }
    : { appId: privyAppId };

  return (
    <PrivyProvider
      {...privyProviderProps}
      config={{
        loginMethodsAndOrder: {
          primary: ["google", "twitter", "email", "solflare"],
          overflow: ["phantom", "backpack", "detected_solana_wallets", "wallet_connect_qr_solana"]
        },
        appearance: {
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
          walletList: [...privyWalletList]
        },
        externalWallets: {
          solana: {
            connectors: privySolanaConnectors
          }
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off"
          },
          solana: {
            createOnLogin: "off"
          }
        }
      }}
    >
      {walletTree}
    </PrivyProvider>
  );
}
