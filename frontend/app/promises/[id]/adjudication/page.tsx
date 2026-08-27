"use client";

import { use } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePromise } from "@/hooks/usePromiseData";
import { useWallet } from "@/hooks/useWallet";
import { useContractTx } from "@/hooks/useContractTx";
import { resolvePromise } from "@/lib/genlayer";
import { Button, Card, CardHeader, EmptyState, ErrorState, Spinner, StatusBadge } from "@/components/ui";
import { TxStatus } from "@/components/TxStatus";
import { bpsToPercent, formatTs } from "@/lib/format";

const STEP_LABELS = [
  { title: "Evidence fetched", body: "The contract independently fetches each submitted evidence URL — nothing about the content is trusted from calldata." },
  { title: "Criteria compared", body: "The promise's conditions are compared against the fetched evidence by the adjudicating validators." },
  { title: "Verdict & payout split", body: "Validators reach consensus on a verdict band and, for partial fulfillment, a payout split." },
];

export default function AdjudicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const promiseId = Number(id);
  const { data: promise, isLoading, isError } = usePromise(promiseId);
  const { isConnected, connect, contractConfigured } = useWallet();
  const { run, state, error, txHash } = useContractTx();
  const queryClient = useQueryClient();

  if (!contractConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState title="Contract not configured" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="flex items-center gap-2 text-on-surface-variant"><Spinner className="h-5 w-5" /> Loading…</div>
      </div>
    );
  }

  if (isError || !promise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <ErrorState title={`Could not load promise #${id}`} />
      </div>
    );
  }

  const hasVerdict = promise.verdict_band !== "NONE" || promise.final_band !== "NONE";
  const canTrigger = promise.status === "EVIDENCE_SUBMITTED" || promise.status === "UNDETERMINED";
  const isInFlight = state === "pending" || state === "confirming";

  async function trigger() {
    const result = await run((args) => resolvePromise(args, promiseId));
    if (result !== null) {
      queryClient.invalidateQueries({ queryKey: ["promise", promiseId] });
      queryClient.invalidateQueries({ queryKey: ["activity", promiseId] });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="font-mono-data text-xs text-on-surface-variant">Promise #{promise.id}</p>
      <h1 className="mt-1 text-2xl font-bold text-on-surface">Adjudication</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{promise.title}</p>
      <div className="mt-3"><StatusBadge status={promise.status} /></div>

      <Card className="my-6">
        <CardHeader title="How adjudication works" />
        <div className="flex flex-col divide-y divide-outline-variant">
          {STEP_LABELS.map((s, i) => (
            <div key={s.title} className="flex gap-4 p-5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-semibold text-on-surface-variant">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">{s.title}</p>
                <p className="mt-0.5 text-sm text-on-surface-variant">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-outline-variant px-5 py-3 text-xs text-on-surface-variant">
          This is a single transaction, not a live stream — GenLayer validators run adjudication off-chain and reach
          consensus before the transaction confirms. This page shows the outcome once confirmed, not a fabricated
          real-time trace of validator internals.
        </p>
      </Card>

      {isInFlight ? (
        <Card className="mb-6 flex flex-col items-center gap-3 p-10 text-center">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm font-semibold text-on-surface">Adjudication in progress…</p>
          <p className="max-w-sm text-sm text-on-surface-variant">
            GenLayer validators are fetching evidence and reaching consensus. This can take a little while — keep this
            tab open.
          </p>
        </Card>
      ) : null}

      {hasVerdict ? (
        <Card className="mb-6">
          <CardHeader title="Verdict" meta={promise.resolved_ts ? formatTs(promise.resolved_ts) : undefined} />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="label-caps mb-1">Band</p>
                <p className="text-lg font-bold text-on-surface">{promise.final_band !== "NONE" ? promise.final_band : promise.verdict_band}</p>
              </div>
              <div>
                <p className="label-caps mb-1">Creator payout share</p>
                <p className="text-lg font-bold text-on-surface">{bpsToPercent(promise.final_creator_payout_bps || promise.creator_payout_bps)}</p>
              </div>
            </div>
            {promise.verdict_reasoning ? (
              <div className="mt-4 border-t border-outline-variant pt-4">
                <p className="label-caps mb-1">Reasoning</p>
                <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{promise.verdict_reasoning}</p>
              </div>
            ) : null}
            {promise.contest_outcome ? (
              <div className="mt-4 border-t border-outline-variant pt-4">
                <p className="label-caps mb-1">Contest outcome</p>
                <p className="text-sm text-on-surface">{promise.contest_outcome}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : !isInFlight ? (
        <EmptyState title="No verdict recorded yet" description="Adjudication hasn't been run for this promise yet." />
      ) : null}

      {!isConnected ? (
        <Button onClick={connect}>Connect wallet</Button>
      ) : canTrigger ? (
        <div className="flex flex-col gap-3">
          <Button onClick={trigger} disabled={isInFlight}>
            {isInFlight ? "Running…" : promise.status === "UNDETERMINED" ? "Retry adjudication" : "Run adjudication"}
          </Button>
          <p className="text-xs text-on-surface-variant">Adjudication is permissionless — any address may trigger it.</p>
          <TxStatus state={state} error={error} txHash={txHash} />
        </div>
      ) : null}
    </div>
  );
}
