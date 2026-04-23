import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  CurveCalculator,
  DEV_API_URLS,
  FeeOn,
  Raydium,
  TxVersion
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { appConfig, requireEnv } from "@/lib/config";
import { fromRawAmount } from "@/lib/number";

const devnetApiUrls = {
  ...DEV_API_URLS,
  BASE_HOST: "https://api-v3-devnet.raydium.io",
  OWNER_BASE_HOST: "https://owner-v1-devnet.raydium.io",
  SWAP_HOST: "https://transaction-v1-devnet.raydium.io",
  CPMM_LOCK: "https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position"
};

export async function prepareRaydiumDevnetSwap(owner: string, inputMint: string, outputMint: string, amountRaw: string) {
  const poolId = requireEnv(appConfig.raydiumDevnetPoolId, "RAYDIUM_DEVNET_POOL_ID");
  const rpcUrl = requireEnv(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "", "NEXT_PUBLIC_SOLANA_RPC_URL");
  const connection = new Connection(rpcUrl, "confirmed");
  const ownerPublicKey = new PublicKey(owner);

  const raydium = await Raydium.load({
    owner: ownerPublicKey,
    connection,
    cluster: "devnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: "confirmed",
    urlConfigs: devnetApiUrls
  });

  const quote = await quoteRaydiumDevnetSwap(inputMint, outputMint, amountRaw, raydium);
  const { poolInfo, poolKeys, inputAmount, swapResult, baseIn } = quote;

  const { transaction } = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount,
    swapResult,
    slippage: appConfig.fixedSlippageBps / 10000,
    baseIn,
    txVersion: TxVersion.V0,
    config: {
      associatedOnly: false
    }
  });

  return {
    quoteResponse: {
      engine: "raydium-devnet",
      poolId,
      inputMint,
      outputMint,
      inputAmount: amountRaw,
      outputAmount: swapResult.outputAmount.toString()
    },
    swapTransaction: Buffer.from((transaction as VersionedTransaction).serialize()).toString("base64"),
    expectedOutputRaw: swapResult.outputAmount.toString(),
    expectedOutputUi: fromRawAmount(swapResult.outputAmount.toString(), quote.outputDecimals),
    outputDecimals: quote.outputDecimals,
    outputSymbol: quote.outputSymbol,
    outputName: quote.outputName
  };
}

export async function quoteRaydiumDevnetValue(inputMint: string, outputMint: string, amountRaw: string) {
  const quote = await quoteRaydiumDevnetSwap(inputMint, outputMint, amountRaw);
  return fromRawAmount(quote.swapResult.outputAmount.toString(), quote.outputDecimals);
}

async function quoteRaydiumDevnetSwap(inputMint: string, outputMint: string, amountRaw: string, raydium?: Raydium) {
  const poolId = requireEnv(appConfig.raydiumDevnetPoolId, "RAYDIUM_DEVNET_POOL_ID");
  const rpcUrl = requireEnv(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "", "NEXT_PUBLIC_SOLANA_RPC_URL");
  const sdk = raydium ?? await Raydium.load({
    owner: new PublicKey("11111111111111111111111111111111"),
    connection: new Connection(rpcUrl, "confirmed"),
    cluster: "devnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: "confirmed",
    urlConfigs: devnetApiUrls
  });

  const { poolInfo, poolKeys, rpcData } = await sdk.cpmm.getPoolInfoFromRpc(poolId);

  if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) {
    throw new Error(`Input mint ${inputMint} does not match Raydium pool ${poolId}.`);
  }

  if (outputMint !== poolInfo.mintA.address && outputMint !== poolInfo.mintB.address) {
    throw new Error(`Output mint ${outputMint} does not match Raydium pool ${poolId}.`);
  }

  const baseIn = inputMint === poolInfo.mintA.address;
  const inputAmount = new BN(amountRaw);
  const swapResult = CurveCalculator.swapBaseInput(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate,
    rpcData.configInfo!.creatorFeeRate,
    rpcData.configInfo!.protocolFeeRate,
    rpcData.configInfo!.fundFeeRate,
    rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
  );

  return {
    poolInfo,
    poolKeys,
    rpcData,
    baseIn,
    inputAmount,
    swapResult,
    outputDecimals: baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals,
    outputSymbol: baseIn ? poolInfo.mintB.symbol : poolInfo.mintA.symbol,
    outputName: baseIn ? poolInfo.mintB.name : poolInfo.mintA.name
  };
}
