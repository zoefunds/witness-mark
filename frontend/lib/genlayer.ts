"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Address } from "viem";
import { env, isContractConfigured } from "./env";
import type { PromiseRecord, ActivityEvent, PlatformStats, Reputation, ProtocolConfig } from "./types";

// Thin wrapper around genlayer-js's client, scoped to the WitnessMark
// contract. Every method name below is copied verbatim from
// contracts/witnessmark_contract.py — never invent new ones here.

function buildChain() {
  if (env.genlayerChainId && env.genlayerRpcUrl) {
    return {
      id: Number(env.genlayerChainId),
      name: "GenLayer",
      rpcUrls: { default: { http: [env.genlayerRpcUrl] } },
      nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
    };
  }
  return undefined;
}

export function getGenlayerClient(provider?: unknown) {
  const chain = buildChain();
  return createClient({
    chain: chain ?? studionet,
    endpoint: env.genlayerRpcUrl || undefined,
    provider: provider as never,
  });
}

export class ContractNotConfiguredError extends Error {
  constructor() {
    super("WitnessMark contract address is not configured yet.");
    this.name = "ContractNotConfiguredError";
  }
}

function requireAddress(): Address {
  if (!isContractConfigured()) throw new ContractNotConfiguredError();
  return env.contractAddress as Address;
}

export async function readPromise(promiseId: number): Promise<PromiseRecord> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_promise",
    args: [promiseId],
  });
  return result as unknown as PromiseRecord;
}

export async function readPromiseCount(): Promise<number> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_promise_count",
    args: [],
  });
  return Number(result);
}

export async function readPartyPromiseIds(addr: string): Promise<number[]> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_party_promise_ids",
    args: [addr],
  });
  return (result as unknown as number[]).map(Number);
}

export async function readActivity(promiseId: number, offset = 0, limit = 25): Promise<ActivityEvent[]> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_activity",
    args: [promiseId, offset, limit],
  });
  return result as unknown as ActivityEvent[];
}

export async function readPlatformStats(): Promise<PlatformStats> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_platform_stats",
    args: [],
  });
  return result as unknown as PlatformStats;
}

export async function readReputation(addr: string): Promise<Reputation> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_reputation",
    args: [addr],
  });
  return result as unknown as Reputation;
}

export async function readConfig(): Promise<ProtocolConfig> {
  const client = getGenlayerClient();
  const address = requireAddress();
  const result = await client.readContract({
    address,
    functionName: "get_config",
    args: [],
  });
  return result as unknown as ProtocolConfig;
}

// ---------------------------------------------------------------------------
// Writes -- each requires a connected wallet `provider` (EIP-1193) so the
// user signs the transaction themselves. Callers pass the wagmi connector's
// provider through.
// ---------------------------------------------------------------------------

export interface WriteArgs {
  provider: unknown;
  account: `0x${string}`;
}

export async function createPromise(
  { provider, account }: WriteArgs,
  params: {
    counterparty: string;
    title: string;
    statement: string;
    conditions: string;
    evidenceRequirements: string;
    category: string;
    acceptWindowSeconds: number;
    evidenceWindowSeconds: number;
    stakeWei: bigint;
  },
) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "create_promise",
    args: [
      params.counterparty,
      params.title,
      params.statement,
      params.conditions,
      params.evidenceRequirements,
      params.category,
      params.acceptWindowSeconds,
      params.evidenceWindowSeconds,
    ],
    value: params.stakeWei,
  });
}

export async function acceptPromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "accept_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function cancelPromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "cancel_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function submitEvidence(
  { provider, account }: WriteArgs,
  promiseId: number,
  urls: string[],
  note: string,
) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "submit_evidence",
    args: [promiseId, JSON.stringify(urls), note],
    value: 0n,
  });
}

export async function resolvePromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "resolve_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function finalizePromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "finalize_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function contestVerdict({ provider, account }: WriteArgs, promiseId: number, bondWei: bigint) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "contest_verdict",
    args: [promiseId],
    value: bondWei,
  });
}

export async function resolveContest({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "resolve_contest",
    args: [promiseId],
    value: 0n,
  });
}

export async function timeoutUnacceptedReclaim({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "timeout_unaccepted_reclaim",
    args: [promiseId],
    value: 0n,
  });
}

export async function timeoutNoEvidenceReclaim({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "timeout_no_evidence_reclaim",
    args: [promiseId],
    value: 0n,
  });
}

export async function forceRefundUndetermined({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return client.writeContract({
    account: { address: account } as never,
    address,
    functionName: "force_refund_undetermined",
    args: [promiseId],
    value: 0n,
  });
}
