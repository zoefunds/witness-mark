"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiAdapter } from "@/lib/wagmi-config";
import { E2EWalletHook } from "@/components/E2EWalletHook";
import "@/lib/appkit";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <E2EWalletHook />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
