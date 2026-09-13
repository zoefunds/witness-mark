"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { Address } from "viem";
import { env, isContractConfigured } from "./env";
import type { PromiseRecord, ActivityEvent, PlatformStats, Reputation, ProtocolConfig } from "./types";

// Thin wrapper around genlayer-js's client, scoped to the WitnessMark
// contract. Every method name below is copied verbatim from
// contracts/witnessmark_contract.py — never invent new ones here.

// IMPORTANT: always pass genlayer-js's own `studionet` chain object here,
// never a hand-built substitute. `ClientConfig.chain`'s public TypeScript
// type only requires {id, name, rpcUrls, nativeCurrency}, which looks
// like enough to reconstruct manually from env vars -- but genlayer-js's
// actual write path needs GenLayer-specific runtime fields `studionet`
// carries that aren't part of that public type (notably
// `consensusMainContract`, used to build/send the real GenVM
// transaction). A hand-built chain object silently passes typechecking
// but breaks every write with "Cannot convert undefined to a BigInt" --
// found via `frontend/e2e/signed-lifecycle.spec.ts`'s real signed E2E
// test, which is the first thing that ever exercised this exact code
// path with a real wallet (every prior write-path verification went
// through gltest/genlayer-py directly, never through this file). If a
// genuinely different GenLayer network needs supporting later, add its
// own `genlayer-js/chains` export rather than reconstructing one by hand.
export function getGenlayerClient(provider?: unknown) {
  return createClient({
    chain: studionet,
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

export interface WriteResult {
  hash: string;
  receipt: unknown;
}

// genlayer-js's `writeContract` returns only the raw transaction hash the
// wallet signed -- it does NOT wait for GenLayer consensus to accept the
// transaction (see backend/scripts/wm-lib.cjs's `write()`, which follows
// this same two-step pattern against the same contract). Every write here
// used to return that bare hash straight to the UI, which treated it as
// "confirmed" the instant the wallet returned -- before the transaction had
// actually been through consensus at all, and with no way to recover the
// hash (a bare string doesn't have a `.hash`/`.tx_hash` field, which is what
// the UI was actually checking for). Found via
// frontend/e2e/signed-lifecycle.spec.ts's real signed E2E test: "Promise
// created" rendered with no tx hash and no promise id ever shown, on the
// very first live run against a real wallet.
async function writeAndWait(
  client: ReturnType<typeof getGenlayerClient>,
  args: {
    account: { address: string };
    address: Address;
    functionName: string;
    args: unknown[];
    value: bigint;
  },
): Promise<WriteResult> {
  const hash = await client.writeContract(args as never);
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.ACCEPTED,
  } as never);
  return { hash: String(hash), receipt };
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
  return writeAndWait(client, {
    account: { address: account },
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
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "accept_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function cancelPromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
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
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "submit_evidence",
    args: [promiseId, JSON.stringify(urls), note],
    value: 0n,
  });
}

export async function resolvePromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "resolve_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function finalizePromise({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "finalize_promise",
    args: [promiseId],
    value: 0n,
  });
}

export async function contestVerdict({ provider, account }: WriteArgs, promiseId: number, bondWei: bigint) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "contest_verdict",
    args: [promiseId],
    value: bondWei,
  });
}

export async function resolveContest({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "resolve_contest",
    args: [promiseId],
    value: 0n,
  });
}

export async function timeoutUnacceptedReclaim({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "timeout_unaccepted_reclaim",
    args: [promiseId],
    value: 0n,
  });
}

export async function timeoutNoEvidenceReclaim({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "timeout_no_evidence_reclaim",
    args: [promiseId],
    value: 0n,
  });
}

export async function forceRefundUndetermined({ provider, account }: WriteArgs, promiseId: number) {
  const client = getGenlayerClient(provider);
  const address = requireAddress();
  return writeAndWait(client, {
    account: { address: account },
    address,
    functionName: "force_refund_undetermined",
    args: [promiseId],
    value: 0n,
  });
}
