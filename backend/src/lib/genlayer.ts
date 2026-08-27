import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { env } from "./env.js";

/**
 * The backend NEVER holds a private key and NEVER signs a transaction on a
 * user's behalf -- every state-changing call (create_promise,
 * accept_promise, submit_evidence, resolve_promise, contest_verdict,
 * finalize_promise, timeout reclaims) is signed client-side by the user's
 * own connected wallet via genlayer-js in the frontend. This backend
 * client is READ-ONLY: it only ever calls client.readContract against the
 * deployed WitnessMark contract, to serve cached view data (promise
 * detail, reputation, platform stats, config) without every page load
 * hitting StudioNet directly and tripping its 30 requests/minute limit.
 */
const client = createClient({
  chain: studionet,
});

export const CONTRACT_ADDRESS = env.GENLAYER_CONTRACT_ADDRESS as `0x${string}`;

export async function readContract<T = unknown>(functionName: string, args: unknown[] = []): Promise<T> {
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as any,
  });
  return result as T;
}

// -- Typed wrappers matching contracts/witnessmark_contract.py's public
//    view methods EXACTLY (method names, arg order, return shape). Never
//    invent a method name here that isn't in the deployed contract. -------

export interface PromiseRecord {
  id: number;
  creator: string;
  counterparty: string;
  title: string;
  statement: string;
  conditions: string;
  evidence_requirements: string;
  category: string;
  status: string;
  created_ts: number;
  accept_by_ts: number;
  evidence_by_ts: number;
  stake_wei: number;
  stake_deposited_wei: number;
  contest_bond_wei: number;
  contest_bond_deposited_wei: number;
  contester: string;
  evidence_urls: string[];
  evidence_note: string;
  evidence_submitted_ts: number;
  verdict_band: string;
  creator_payout_bps: number;
  verdict_reasoning: string;
  verdict_evidence_hash: string;
  final_band: string;
  final_creator_payout_bps: number;
  contest_outcome: string;
  resolve_attempts: number;
  contest_count: number;
  resolved_ts: number;
  finalized_ts: number;
}

export interface ReputationSummary {
  address: string;
  promises_made: number;
  promises_finalized: number;
  fulfilled: number;
  partially_fulfilled: number;
  broken: number;
  contested: number;
  total_staked_wei: number;
  fulfillment_rate_bps: number;
}

export interface PlatformStats {
  total_promises: number;
  total_volume_wei: number;
  total_fulfilled: number;
  total_partial: number;
  total_broken: number;
  total_contests: number;
}

export interface ContractConfig {
  contest_bond_bps: number;
  contest_window_seconds: number;
  undetermined_grace_seconds: number;
  max_resolve_attempts: number;
  min_accept_window_seconds: number;
  max_accept_window_seconds: number;
  min_evidence_window_seconds: number;
  max_evidence_window_seconds: number;
  max_evidence_items: number;
}

export const genlayerReads = {
  getPromise: (promiseId: number) => readContract<PromiseRecord>("get_promise", [promiseId]),
  getPromiseSummary: (promiseId: number) =>
    readContract<{ id: number; status: string; stake_wei: number; final_band: string }>("get_promise_summary", [
      promiseId,
    ]),
  getPromiseCount: () => readContract<number>("get_promise_count", []),
  getPartyPromiseIds: (address: string) => readContract<number[]>("get_party_promise_ids", [address]),
  getActivity: (promiseId: number, offset = 0, limit = 25) =>
    readContract<Array<{ kind: string; actor: string; amount: number; ts: number; note: string }>>(
      "get_activity",
      [promiseId, offset, limit],
    ),
  getPlatformStats: () => readContract<PlatformStats>("get_platform_stats", []),
  getReputation: (address: string) => readContract<ReputationSummary>("get_reputation", [address]),
  getConfig: () => readContract<ContractConfig>("get_config", []),
};
