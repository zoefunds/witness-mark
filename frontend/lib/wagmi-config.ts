import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "viem";
import { env } from "./env";

// GenLayer network, described as a viem/AppKit chain. Falls back to a
// placeholder RPC when env vars are unset so the app can still render (the
// wallet/settings page surfaces "network not configured" in that case).
export const genlayerNetwork = defineChain({
  id: env.genlayerChainId ? Number(env.genlayerChainId) : 61999,
  name: "GenLayer StudioNet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: [env.genlayerRpcUrl || "https://studio.genlayer.com/api"] },
  },
  blockExplorers: undefined,
  testnet: true,
});

export const projectId = env.reownProjectId;

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || "missing-project-id",
  networks: [genlayerNetwork],
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
