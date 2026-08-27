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
  stake_wei: string;
  stake_deposited_wei: string;
  contest_bond_wei: string;
  contest_bond_deposited_wei: string;
  contester: string;
  // Plain array of URL strings — matches `_promise_dict()` in
  // contracts/witnessmark_contract.py exactly (json.loads of
  // evidence_urls_json, which submit_evidence() stores as a flat list of
  // validated URL strings, not {url, kind} objects).
  evidence_urls: string[];
  evidence_note: string;
  evidence_submitted_ts: number;
  verdict_band: string;
  creator_payout_bps: number;
  verdict_reasoning: string;
  // sha256 provenance fingerprint of exactly what evidence content was
  // fetched at adjudication time — audit trail only, not a consensus
  // gate (see docs/contract.md "Evidence tamper-evidence"). Empty string
  // until a verdict has been recorded.
  verdict_evidence_hash: string;
  final_band: string;
  final_creator_payout_bps: number;
  contest_outcome: string;
  resolve_attempts: number;
  contest_count: number;
  resolved_ts: number;
  finalized_ts: number;
}

export interface ActivityEvent {
  kind: string;
  actor: string;
  amount: number;
  ts: number;
  note: string;
}

export interface PlatformStats {
  total_promises: number;
  total_volume_wei: string | number;
  total_fulfilled: number;
  total_partial: number;
  total_broken: number;
  total_contests: number;
}

export interface Reputation {
  address: string;
  promises_made: number;
  promises_finalized: number;
  fulfilled: number;
  partially_fulfilled: number;
  broken: number;
  contested: number;
  total_staked_wei: string | number;
  fulfillment_rate_bps: number;
}

export interface ProtocolConfig {
  contest_bond_bps: number;
  contest_window_seconds: number;
  undetermined_grace_seconds: number;
  max_resolve_attempts: number;
  min_accept_window_seconds: number;
  max_accept_window_seconds: number;
  min_evidence_window_seconds: number;
  max_evidence_window_seconds: number;
  max_evidence_items: number;
  // Added to get_config()'s return dict after the currently-deployed
  // instance went live — optional here so the type doesn't break against
  // an older deployment that predates them. lib/actions.ts falls back to
  // EVIDENCE_LATE_GRACE_SECONDS_FALLBACK (which mirrors the contract's
  // own constant) when this is undefined. See MEMORY.md.
  evidence_late_grace_seconds?: number;
  high_value_stake_threshold_wei?: number | string;
  min_evidence_items_high_value?: number;
}
