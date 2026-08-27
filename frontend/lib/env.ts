export const env = {
  reownProjectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  genlayerChainId: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? "",
  genlayerRpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "",
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "",
};

export const isContractConfigured = () =>
  Boolean(env.contractAddress && env.contractAddress.length > 0);
