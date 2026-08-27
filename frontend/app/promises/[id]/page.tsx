"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { usePromise, useActivity, useProtocolConfig } from "@/hooks/usePromiseData";
import { useWallet } from "@/hooks/useWallet";
import { useContractTx } from "@/hooks/useContractTx";
import {
  acceptPromise,
  cancelPromise,
  resolvePromise,
  finalizePromise,
  contestVerdict,
  resolveContest,
  timeoutUnacceptedReclaim,
  timeoutNoEvidenceReclaim,
  forceRefundUndetermined,
} from "@/lib/genlayer";
import { Button, Card, CardHeader, EmptyState, ErrorState, LinkButton, Spinner, StakedChip, StatusBadge } from "@/components/ui";
import { TxStatus } from "@/components/TxStatus";
import { bpsToPercent, formatTs, relativeTime, truncateAddress, weiToGen } from "@/lib/format";
import { STATUS_EXPLANATIONS } from "@/lib/constants";
import { getAvailableActions, type ActionKind } from "@/lib/actions";

// Fallback only for a config load that hasn't resolved yet -- mirrors the
// contract's CONTEST_BOND_BPS constant. Prefer the live get_config() read
// (see requiredBond below) since this is a contract-configurable value,
// not something the frontend should assume is fixed forever.
const CONTEST_BOND_BPS_FALLBACK = 1500;

export default function PromiseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const promiseId = Number(id);
  const { data: promise, isLoading, isError, error } = usePromise(promiseId);
  const { data: activity } = useActivity(promiseId);
  const { data: config } = useProtocolConfig();
  const { address, isConnected, connect, contractConfigured } = useWallet();
  const { run, state, error: txError, txHash, reset } = useContractTx();
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  if (!contractConfigured) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <EmptyState title="Contract not configured" description="Set NEXT_PUBLIC_CONTRACT_ADDRESS to view live promise data." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Spinner className="h-5 w-5" /> Loading promise #{id}…
        </div>
      </div>
    );
  }

  if (isError || !promise) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <ErrorState title={`Could not load promise #${id}`} description={error instanceof Error ? error.message : "It may not exist."} />
      </div>
    );
  }

  const info = STATUS_EXPLANATIONS[promise.status as keyof typeof STATUS_EXPLANATIONS];
  const actions = getAvailableActions(promise, address, nowSec, config);
  const contestBondBps = config?.contest_bond_bps ?? CONTEST_BOND_BPS_FALLBACK;
  const requiredBond = (BigInt(promise.stake_wei || "0") * BigInt(contestBondBps)) / 10000n;

  async function handleAction(kind: ActionKind) {
    setActiveAction(kind);
    let result: unknown = null;
    switch (kind) {
      case "accept":
        result = await run((args) => acceptPromise(args, promiseId));
        break;
      case "cancel":
        result = await run((args) => cancelPromise(args, promiseId));
        break;
      case "resolve":
        result = await run((args) => resolvePromise(args, promiseId));
        break;
      case "finalize":
        result = await run((args) => finalizePromise(args, promiseId));
        break;
      case "contest":
        result = await run((args) => contestVerdict(args, promiseId, requiredBond));
        break;
      case "resolve_contest":
        result = await run((args) => resolveContest(args, promiseId));
        break;
      case "timeout_unaccepted":
        result = await run((args) => timeoutUnacceptedReclaim(args, promiseId));
        break;
      case "timeout_no_evidence":
        result = await run((args) => timeoutNoEvidenceReclaim(args, promiseId));
        break;
      case "force_refund_undetermined":
        result = await run((args) => forceRefundUndetermined(args, promiseId));
        break;
      default:
        break;
    }
    if (result !== null) {
      queryClient.invalidateQueries({ queryKey: ["promise", promiseId] });
      queryClient.invalidateQueries({ queryKey: ["activity", promiseId] });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono-data text-xs text-on-surface-variant">Promise #{promise.id}</p>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">{promise.title}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{promise.statement}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={promise.status} />
          <StakedChip wei={promise.stake_deposited_wei} />
        </div>
      </div>

      {/* Plain-English status explanation — UX principle: always understand what's happening & what happens next. */}
      {info ? (
        <Card className="mb-6 p-5">
          <p className="text-sm font-semibold text-on-surface">{info.label}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{info.description}</p>
          <p className="mt-2 text-sm font-medium text-on-surface">What happens financially: <span className="font-normal text-on-surface-variant">{info.financial}</span></p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Terms" meta={promise.category} />
            <div className="flex flex-col gap-4 p-5">
              <div>
                <p className="label-caps mb-1">Conditions</p>
                <p className="whitespace-pre-wrap text-sm text-on-surface">{promise.conditions}</p>
              </div>
              <div>
                <p className="label-caps mb-1">Evidence requirements</p>
                <p className="whitespace-pre-wrap text-sm text-on-surface">{promise.evidence_requirements || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-outline-variant pt-4 text-sm">
                <div>
                  <p className="label-caps mb-1">Creator</p>
                  <p className="font-mono-data">{truncateAddress(promise.creator)}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Counterparty</p>
                  <p className="font-mono-data">{truncateAddress(promise.counterparty)}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Created</p>
                  <p>{formatTs(promise.created_ts)}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Accept by</p>
                  <p>{formatTs(promise.accept_by_ts)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Evidence" meta={promise.evidence_submitted_ts ? formatTs(promise.evidence_submitted_ts) : undefined} />
            <div className="p-5">
              {promise.evidence_urls.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No evidence submitted yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {promise.evidence_urls.map((url, i) => (
                    <li key={i} className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2">
                      <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono-data text-sm text-primary underline">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {promise.evidence_note ? (
                <p className="mt-3 text-sm text-on-surface-variant"><span className="font-semibold text-on-surface">Note: </span>{promise.evidence_note}</p>
              ) : null}
              <div className="mt-4">
                <LinkButton href={`/promises/${promise.id}/evidence`} variant="outline">Evidence panel →</LinkButton>
              </div>
            </div>
          </Card>

          {(promise.verdict_band !== "NONE" || promise.final_band !== "NONE") ? (
            <Card>
              <CardHeader title="Adjudication" />
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="label-caps mb-1">Verdict band</p>
                    <p className="font-semibold">{promise.final_band !== "NONE" ? promise.final_band : promise.verdict_band}</p>
                  </div>
                  <div>
                    <p className="label-caps mb-1">Creator payout share</p>
                    <p className="font-semibold">{bpsToPercent(promise.final_creator_payout_bps || promise.creator_payout_bps)}</p>
                  </div>
                </div>
                {promise.verdict_reasoning ? (
                  <div className="mt-4 border-t border-outline-variant pt-4">
                    <p className="label-caps mb-1">Reasoning</p>
                    <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{promise.verdict_reasoning}</p>
                  </div>
                ) : null}
                {promise.verdict_evidence_hash ? (
                  <div className="mt-4 border-t border-outline-variant pt-4">
                    <p className="label-caps mb-1">Evidence fingerprint</p>
                    <p className="break-all font-mono-data text-xs text-on-surface-variant">{promise.verdict_evidence_hash}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      A sha256 fingerprint of exactly what evidence content validators fetched — an audit trail, not
                      part of the verdict itself. If the linked evidence is later suspected to have changed, this is
                      concrete grounds to contest.
                    </p>
                  </div>
                ) : null}
                <div className="mt-4">
                  <LinkButton href={`/promises/${promise.id}/adjudication`} variant="outline">Full adjudication view →</LinkButton>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Timeline" />
            <div className="flex flex-col divide-y divide-outline-variant">
              {!activity || activity.length === 0 ? (
                <p className="p-5 text-sm text-on-surface-variant">No activity recorded yet.</p>
              ) : (
                activity.map((evt, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">{evt.kind.replaceAll("_", " ")}</p>
                      <p className="text-xs text-on-surface-variant">
                        {truncateAddress(evt.actor)} · {relativeTime(evt.ts)}
                        {evt.note ? ` · ${evt.note}` : ""}
                      </p>
                    </div>
                    {evt.amount ? <p className="font-mono-data text-xs text-on-surface-variant">{weiToGen(evt.amount)} GEN</p> : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <p className="label-caps mb-3">Stake</p>
            <p className="text-2xl font-bold text-on-surface">{weiToGen(promise.stake_deposited_wei)} GEN</p>
            <p className="mt-1 text-xs text-on-surface-variant">Agreed stake: {weiToGen(promise.stake_wei)} GEN</p>
            {promise.contest_bond_deposited_wei !== "0" ? (
              <p className="mt-2 text-xs text-on-surface-variant">Contest bond escrowed: {weiToGen(promise.contest_bond_deposited_wei)} GEN</p>
            ) : null}
          </Card>

          <Card className="p-5">
            <p className="label-caps mb-3">Actions</p>
            {!isConnected ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-on-surface-variant">Connect your wallet to take action on this promise.</p>
                <Button onClick={connect}>Connect wallet</Button>
              </div>
            ) : actions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No actions available for your role right now.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {actions.map((a) => (
                  <div key={a.kind} className="flex flex-col gap-2">
                    <Button variant={a.variant} onClick={() => handleAction(a.kind)} disabled={state === "pending" || state === "confirming"}>
                      {a.label}
                    </Button>
                    <p className="text-xs text-on-surface-variant">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
            {activeAction ? (
              <div className="mt-3">
                <TxStatus state={state} error={txError} txHash={txHash} />
                {state === "confirmed" || state === "failed" ? (
                  <button onClick={() => { reset(); setActiveAction(null); }} className="mt-2 text-xs font-medium text-on-surface-variant underline">
                    Dismiss
                  </button>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Link href="/promises" className="text-center text-xs font-medium text-on-surface-variant hover:text-on-surface">
            ← Back to promises
          </Link>
        </div>
      </div>
    </div>
  );
}
