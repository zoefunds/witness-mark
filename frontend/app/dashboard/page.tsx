"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useMyPromises, useReputation } from "@/hooks/usePromiseData";
import { Card, EmptyState, LinkButton, StatusBadge, Spinner } from "@/components/ui";
import { bpsToPercent, weiToGen } from "@/lib/format";
import type { PromiseRecord } from "@/lib/types";
import { isTerminal } from "@/lib/constants";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      {sub ? <p className="mt-1 text-xs text-on-surface-variant">{sub}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected, connect, contractConfigured } = useWallet();
  const { promises, isLoading } = useMyPromises(address);
  const { data: reputation } = useReputation(address);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
        <EmptyState
          title="Connect your wallet to view your dashboard"
          description="Your dashboard shows the promises you've created or been named in, plus your protocol reputation."
          action={
            <button
              onClick={connect}
              className="focus-ring rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-container"
            >
              Connect wallet
            </button>
          }
        />
      </div>
    );
  }

  const list = promises as PromiseRecord[];
  const active = list.filter((p) => !isTerminal(p.status));
  const fulfilled = list.filter((p) => p.status === "FULFILLED").length;
  const broken = list.filter((p) => p.status === "BROKEN").length;
  const pendingEvidence = list.filter((p) => p.status === "ACCEPTED").length;
  const pendingAdjudication = list.filter((p) => p.status === "EVIDENCE_SUBMITTED" || p.status === "UNDETERMINED").length;
  const asCreator = list.filter((p) => p.creator.toLowerCase() === address?.toLowerCase());
  const staked = asCreator.reduce((sum, p) => sum + BigInt(p.stake_deposited_wei || "0"), 0n);
  const returned = asCreator
    .filter((p) => isTerminal(p.status))
    .reduce((sum, p) => sum + BigInt(p.stake_deposited_wei || "0"), 0n);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dashboard</h1>
          <p className="text-sm text-on-surface-variant">Overview of promises you&apos;re party to.</p>
        </div>
        <LinkButton href="/promises/new">New promise</LinkButton>
      </div>

      {!contractConfigured ? (
        <EmptyState title="Contract not configured" description="Set NEXT_PUBLIC_CONTRACT_ADDRESS to load live data." />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-16 text-on-surface-variant">
          <Spinner className="h-5 w-5" /> Loading your promises…
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile label="Total promises" value={String(list.length)} />
            <StatTile label="Active" value={String(active.length)} />
            <StatTile label="Fulfilled" value={String(fulfilled)} />
            <StatTile label="Broken" value={String(broken)} />
            <StatTile label="Pending evidence" value={String(pendingEvidence)} />
            <StatTile label="Pending adjudication" value={String(pendingAdjudication)} />
            <StatTile label="Capital staked (as creator)" value={`${weiToGen(staked)} GEN`} />
            <StatTile label="Capital returned" value={`${weiToGen(returned)} GEN`} />
          </div>

          {reputation ? (
            <Card className="mb-8 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-caps">Reputation snapshot (as creator)</p>
                <Link href={`/profile/${address}`} className="text-xs font-medium text-on-surface-variant hover:text-on-surface">
                  Full profile →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-on-surface-variant">Promises made</p>
                  <p className="text-lg font-semibold">{reputation.promises_made}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Fulfillment rate</p>
                  <p className="text-lg font-semibold">{bpsToPercent(reputation.fulfillment_rate_bps)}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Broken</p>
                  <p className="text-lg font-semibold">{reputation.broken}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant">Contested</p>
                  <p className="text-lg font-semibold">{reputation.contested}</p>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="mb-4 flex items-center justify-between">
            <h2 className="label-caps">Your promises</h2>
            <Link href="/promises" className="text-xs font-medium text-on-surface-variant hover:text-on-surface">
              View all →
            </Link>
          </div>

          {list.length === 0 ? (
            <EmptyState
              title="No promises yet"
              description="Create your first promise, or ask someone to name you as a counterparty."
              action={<LinkButton href="/promises/new">Create a promise</LinkButton>}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {list.slice(0, 8).map((p) => (
                <Link key={p.id} href={`/promises/${p.id}`} className="card focus-ring flex items-center justify-between p-4 hover:bg-surface-container-low">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{p.title}</p>
                    <p className="font-mono-data text-xs text-on-surface-variant">#{p.id} · {weiToGen(p.stake_wei)} GEN</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
