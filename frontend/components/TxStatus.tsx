import { Spinner } from "./ui";
import type { TxState } from "@/hooks/useContractTx";

export function TxStatus({ state, error, txHash }: { state: TxState; error: string | null; txHash: string | null }) {
  if (state === "idle") return null;

  if (state === "pending" || state === "confirming") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-tertiary-container bg-tertiary-container/60 px-4 py-3 text-sm text-on-tertiary-container">
        <Spinner className="h-4 w-4" />
        {state === "pending" ? "Waiting for wallet signature…" : "Submitting to GenLayer, waiting for confirmation…"}
      </div>
    );
  }

  if (state === "confirmed") {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-secondary-container bg-secondary-container/60 px-4 py-3 text-sm text-on-secondary-container">
        <span className="font-semibold">Transaction confirmed.</span>
        {txHash ? <span className="font-mono-data text-xs">{txHash}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-error-container bg-error-container/60 px-4 py-3 text-sm text-on-error-container">
      <span className="font-semibold">Transaction failed.</span>
      {error ? <span>{error}</span> : null}
    </div>
  );
}
