"use client";

import Link from "next/link";
import { useBalance, useChainId } from "wagmi";
import { useWallet } from "@/hooks/useWallet";
import { Button, Card, EmptyState } from "@/components/ui";
import { truncateAddress, weiToGen } from "@/lib/format";
import { env } from "@/lib/env";

export default function WalletPage() {
  const { address, isConnected, connect, disconnect, contractConfigured, connector } = useWallet();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-on-surface">Wallet & settings</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Connected wallet, network status, and protocol configuration.</p>

      <div className="mt-8 flex flex-col gap-6">
        {!isConnected ? (
          <EmptyState title="No wallet connected" action={<Button onClick={connect}>Connect wallet</Button>} />
        ) : (
          <Card className="p-6">
            <p className="label-caps mb-3">Connected wallet</p>
            <div className="flex flex-col gap-3 text-sm">
              <Row label="Address" value={address ? truncateAddress(address, 8) : "—"} mono />
              <Row label="Connector" value={connector?.name ?? "—"} />
              <Row label="Balance" value={balance ? `${weiToGen(balance.value)} ${balance.symbol}` : "—"} mono />
              <Row label="Chain ID" value={String(chainId ?? "—")} mono />
            </div>
            <div className="mt-5 flex gap-3">
              <Link href={address ? `/profile/${address}` : "#"} className="focus-ring rounded-md border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container">
                View my profile
              </Link>
              <Button variant="outline" onClick={disconnect}>Disconnect</Button>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <p className="label-caps mb-3">Network status</p>
          <div className="flex flex-col gap-3 text-sm">
            <Row label="GenLayer RPC" value={env.genlayerRpcUrl || "Not configured"} mono={Boolean(env.genlayerRpcUrl)} />
            <Row label="Chain ID" value={env.genlayerChainId || "Not configured"} mono={Boolean(env.genlayerChainId)} />
            <Row
              label="WitnessMark contract"
              value={contractConfigured ? env.contractAddress : "Not deployed yet"}
              mono={contractConfigured}
              warn={!contractConfigured}
            />
            <Row label="Backend API" value={env.apiUrl || "Not configured"} mono={Boolean(env.apiUrl)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono, warn }: { label: string; value: string; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant pb-3 last:border-0 last:pb-0">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`text-right ${mono ? "font-mono-data" : ""} ${warn ? "text-tertiary font-medium" : "text-on-surface"}`}>
        {value}
      </span>
    </div>
  );
}
