"use client";

import { use } from "react";
import { useReputation } from "@/hooks/usePromiseData";
import { Card, EmptyState, ErrorState, Spinner } from "@/components/ui";
import { bpsToPercent, truncateAddress, weiToGen } from "@/lib/format";

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { data: reputation, isLoading, isError } = useReputation(address);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="label-caps mb-1">Protocol reputation</p>
      <h1 className="font-mono-data break-all text-2xl font-bold text-on-surface">{truncateAddress(address, 8)}</h1>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-on-surface-variant"><Spinner className="h-5 w-5" /> Loading…</div>
      ) : isError || !reputation ? (
        <div className="mt-8"><ErrorState title="Could not load reputation" description="The contract may not be configured, or this address has no history." /></div>
      ) : reputation.promises_made === 0 ? (
        <div className="mt-8"><EmptyState title="No promises made yet" description="This address hasn't created any promises as a creator." /></div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <Card className="p-6">
            <p className="label-caps mb-4">Protocol facts</p>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Fact label="Promises made" value={String(reputation.promises_made)} />
              <Fact label="Finalized" value={String(reputation.promises_finalized)} />
              <Fact label="Fulfilled" value={String(reputation.fulfilled)} />
              <Fact label="Partially fulfilled" value={String(reputation.partially_fulfilled)} />
              <Fact label="Broken" value={String(reputation.broken)} />
              <Fact label="Contested" value={String(reputation.contested)} />
              <Fact label="Total staked" value={`${weiToGen(reputation.total_staked_wei)} GEN`} />
            </div>
          </Card>

          <Card className="p-6">
            <p className="label-caps mb-2">Derived metric</p>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-on-surface">{bpsToPercent(reputation.fulfillment_rate_bps)}</p>
              <p className="text-sm text-on-surface-variant">fulfillment rate</p>
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              Methodology: fulfilled promises ÷ finalized promises, counted only for promises this address created
              (as guarantor). This is the single derived metric the protocol computes &mdash; it is not a general trust
              score, does not account for promise difficulty or stake size, and says nothing about this address&apos;s
              behavior as a counterparty.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}
