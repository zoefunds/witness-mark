"use client";

import { useAccount, useDisconnect } from "wagmi";
import { appKitModal } from "@/lib/appkit";
import { isContractConfigured } from "@/lib/env";

export function useWallet() {
  const { address, isConnected, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();

  return {
    address,
    isConnected,
    chainId,
    connector,
    contractConfigured: isContractConfigured(),
    connect: () => appKitModal?.open(),
    disconnect: () => disconnect(),
  };
}
