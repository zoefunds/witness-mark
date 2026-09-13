"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import type { WriteArgs } from "@/lib/genlayer";
import { ContractNotConfiguredError } from "@/lib/genlayer";

export type TxState = "idle" | "pending" | "confirming" | "confirmed" | "failed";

export function useContractTx() {
  const { address, connector } = useAccount();
  const [state, setState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: (args: WriteArgs) => Promise<T>): Promise<T | null> => {
      setError(null);
      setTxHash(null);
      if (!address || !connector) {
        setError("Connect a wallet first.");
        setState("failed");
        return null;
      }
      setState("pending");
      try {
        const provider = await connector.getProvider();
        setState("confirming");
        const result = await fn({ provider, account: address });
        const hash = (result as { hash?: string })?.hash;
        if (hash) setTxHash(String(hash));
        setState("confirmed");
        return result;
      } catch (err) {
        const message =
          err instanceof ContractNotConfiguredError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Transaction failed.";
        setError(message);
        setState("failed");
        return null;
      }
    },
    [address, connector],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return { run, state, error, txHash, reset };
}
