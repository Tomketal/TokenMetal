import { Asset, StrKey } from "@stellar/stellar-sdk";
import { usdcAssetId } from "./network";

// Asset ids are "native" (XLM) or "CODE:ISSUER". Stellar Expert style
// "CODE-ISSUER-1" ids are accepted too and normalized.
export function normalizeAssetId(input: string) {
  const value = input.trim();
  if (/^(native|xlm)$/i.test(value)) return "native";

  const match = value.match(/^([a-zA-Z0-9]{1,12})[:-](G[A-Z2-7]{55})(?:-\d)?$/);
  if (!match) throw new Error(`Invalid Stellar asset id "${input}". Use CODE:ISSUER or native.`);

  const [, code, issuer] = match;
  if (!StrKey.isValidEd25519PublicKey(issuer)) throw new Error(`Invalid issuer in asset id "${input}".`);
  return `${code}:${issuer}`;
}

export function isValidAssetId(input: string) {
  try {
    normalizeAssetId(input);
    return true;
  } catch {
    return false;
  }
}

export function parseAsset(input: string) {
  const id = normalizeAssetId(input);
  if (id === "native") return Asset.native();
  const [code, issuer] = id.split(":");
  return new Asset(code, issuer);
}

export function assetIdOf(asset: Asset) {
  return asset.isNative() ? "native" : `${asset.getCode()}:${asset.getIssuer()}`;
}

export function usdcAsset() {
  return parseAsset(usdcAssetId);
}

export function sameAsset(a: Asset, b: Asset) {
  return a.equals(b);
}

// Horizon returns assets as { asset_type, asset_code, asset_issuer }.
export function assetFromHorizon(record: { asset_type: string; asset_code?: string; asset_issuer?: string }) {
  return record.asset_type === "native" ? Asset.native() : new Asset(record.asset_code!, record.asset_issuer!);
}

export function isValidStellarAddress(address: string) {
  return StrKey.isValidEd25519PublicKey(address);
}
