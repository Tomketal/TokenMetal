// Network constants shared by server and client code.
// Kept free of @stellar/stellar-sdk imports so client bundles stay small.

export type StellarNetwork = "mainnet" | "testnet";

export const stellarNetwork: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ? "testnet" : "mainnet";

export const networkPassphrase =
  stellarNetwork === "testnet"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

export const defaultHorizonUrl =
  stellarNetwork === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";

// Circle USDC issuers.
export const defaultUsdcAsset =
  stellarNetwork === "testnet"
    ? "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    : "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

export const usdcAssetId = process.env.NEXT_PUBLIC_USDC_ASSET || defaultUsdcAsset;

// Classic Stellar assets always use 7 decimal places.
export const STELLAR_DECIMALS = 7;

export function explorerTxUrl(hash: string) {
  const net = stellarNetwork === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${net}/tx/${encodeURIComponent(hash)}`;
}

export function explorerAccountUrl(address: string) {
  const net = stellarNetwork === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${net}/account/${encodeURIComponent(address)}`;
}
