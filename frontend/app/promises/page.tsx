"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useMyPromises } from "@/hooks/usePromiseData";
import { Card, EmptyState, LinkButton, StatusBadge, Spinner, inputClasses } from "@/components/ui";
import { weiToGen } from "@/lib/format";
import type { PromiseRecord } from "@/lib/types";
import { PROMISE_STATUSES } from "@/lib/constants";

type RoleFilter = "all" | "creator" | "counterparty";

export default function PromisesListPage() {
  const { address, isConnected, connect, contractConfigured } = useWallet();
  const { promises, isLoading } = useMyPromises(address);
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return (promises as PromiseRecord[]).filter((p) => {
      if (role === "creator" && p.creator.toLowerCase() !== address?.toLowerCase()) return false;
      if (role === "counterparty" && p.counterparty.toLowerCase() !== address?.toLowerCase()) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
  }, [promises, role, status, address]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">My promises</h1>
          <p className="text-sm text-on-surface-variant">Filter by your role and status.</p>
        </div>
        <LinkButton href="/promises/new">New promise</LinkButton>
      </div>

      {!isConnected ? (
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet to see promises you're party to."
          action={
            <button onClick={connect} className="focus-ring rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">
              Connect wallet
            </button>
          }
        />
      ) : !contractConfigured ? (
        <EmptyState title="Contract not configured" description="Set NEXT_PUBLIC_CONTRACT_ADDRESS to load live data." />
      ) : (
        <>
          <Card className="mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="label-caps">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} className={inputClasses + " w-auto"}>
                <option value="all">All</option>
                <option value="creator">Creator</option>
                <option value="counterparty">Counterparty</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="label-caps">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClasses + " w-auto"}>
                <option value="all">All</option>
                {PROMISE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </Card>

          {isLoading ? (
            <div className="flex items-center gap-2 py-16 text-on-surface-variant">
              <Spinner className="h-5 w-5" /> Loading promises…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No promises match" description="Try a different filter, or create a new promise." action={<LinkButton href="/promises/new">Create a promise</LinkButton>} />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((p) => (
                <Link key={p.id} href={`/promises/${p.id}`} className="card focus-ring flex flex-col gap-2 p-4 hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{p.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{p.statement}</p>
                    <p className="font-mono-data mt-1 text-xs text-on-surface-variant">
                      #{p.id} · {weiToGen(p.stake_wei)} GEN · {p.category}
                    </p>
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
