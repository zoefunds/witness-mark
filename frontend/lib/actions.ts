import type { PromiseRecord, ProtocolConfig } from "./types";

// Mirrors contracts/witnessmark_contract.py's EVIDENCE_LATE_GRACE_SECONDS
// (3 days). Used only as a fallback when the connected contract instance
// predates get_config() exposing this value directly (see ProtocolConfig)
// -- prefer the live config value whenever it's available, since a future
// contract redeploy could change this constant and the fallback would
// then be wrong. Keeping a fallback at all, rather than requiring config
// to be loaded, is what fixed a real bug: the "Reclaim stake (no
// evidence)" action was previously shown -- and would revert on-chain --
// a full 3 days before the contract actually allows it, because the
// frontend checked only evidence_by_ts with no grace period at all.
const EVIDENCE_LATE_GRACE_SECONDS_FALLBACK = 259200;

function evidenceLateGraceSeconds(config: ProtocolConfig | undefined): number {
  return config?.evidence_late_grace_seconds ?? EVIDENCE_LATE_GRACE_SECONDS_FALLBACK;
}

export type ActionKind =
  | "accept"
  | "cancel"
  | "submit_evidence"
  | "resolve"
  | "finalize"
  | "contest"
  | "resolve_contest"
  | "timeout_unaccepted"
  | "timeout_no_evidence"
  | "force_refund_undetermined";

export interface AvailableAction {
  kind: ActionKind;
  label: string;
  description: string;
  variant: "primary" | "outline" | "danger";
  permissionless?: boolean;
}

/**
 * Every action below that has a time (or attempt-count) precondition on
 * the contract is gated here by that SAME precondition, computed the same
 * way the contract computes it -- an action must never be offered as
 * available when the underlying transaction would actually revert. `config`
 * is optional (falls back to hardcoded contract constants) so this still
 * degrades gracefully if get_config() hasn't loaded yet, but every
 * consumer should pass the live config once available (see
 * useProtocolConfig / hooks/usePromiseData.ts) since these windows are
 * contract-configurable, not truly fixed.
 */
export function getAvailableActions(
  p: PromiseRecord,
  address: string | undefined,
  nowSec: number,
  config?: ProtocolConfig,
): AvailableAction[] {
  if (!address) return [];
  const isCreator = p.creator.toLowerCase() === address.toLowerCase();
  const isCounterparty = p.counterparty.toLowerCase() === address.toLowerCase();
  const actions: AvailableAction[] = [];

  if (p.status === "CREATED") {
    if (isCounterparty) {
      actions.push({ kind: "accept", label: "Accept promise", description: "Accept this promise and start the evidence window.", variant: "primary" });
    }
    if (isCreator) {
      actions.push({ kind: "cancel", label: "Cancel promise", description: "Cancel before acceptance and reclaim your full stake.", variant: "outline" });
    }
    // No grace period on this one -- contract's timeout_unaccepted_reclaim
    // checks only now_ts > accept_by_ts.
    if (nowSec > p.accept_by_ts) {
      actions.push({ kind: "timeout_unaccepted", label: "Reclaim stake (never accepted)", description: "The accept window has passed with no acceptance. Anyone may trigger this reclaim.", variant: "outline", permissionless: true });
    }
  }

  if (p.status === "ACCEPTED") {
    if (isCounterparty) {
      actions.push({ kind: "submit_evidence", label: "Submit evidence", description: "Submit evidence for adjudication.", variant: "primary" });
    }
    // Matches timeout_no_evidence_reclaim's exact check: now_ts must be
    // past evidence_by_ts + EVIDENCE_LATE_GRACE_SECONDS, not just
    // evidence_by_ts -- the counterparty still has a grace window to
    // submit late evidence after evidence_by_ts passes (see
    // submit_evidence's own matching grace check), so offering this
    // reclaim any earlier would revert on-chain.
    const graceSeconds = evidenceLateGraceSeconds(config);
    if (p.evidence_by_ts > 0 && nowSec > p.evidence_by_ts + graceSeconds) {
      actions.push({ kind: "timeout_no_evidence", label: "Reclaim stake (no evidence)", description: "The evidence window and its late-submission grace period have both passed with nothing submitted. Anyone may trigger this reclaim.", variant: "outline", permissionless: true });
    }
  }

  if (p.status === "EVIDENCE_SUBMITTED") {
    if (isCounterparty) {
      actions.push({ kind: "submit_evidence", label: "Add more evidence", description: "Resubmit or add additional evidence before adjudication runs.", variant: "outline" });
    }
    actions.push({ kind: "resolve", label: "Run adjudication", description: "Trigger GenLayer to fetch evidence and reach a verdict. Anyone may trigger this.", variant: "primary", permissionless: true });
  }

  if (p.status === "UNDETERMINED") {
    if (p.resolve_attempts < (config?.max_resolve_attempts ?? 5)) {
      actions.push({ kind: "resolve", label: "Retry adjudication", description: "A prior attempt was inconclusive — retry. Anyone may trigger this.", variant: "primary", permissionless: true });
    }
    // Matches force_refund_undetermined's exact checks: resolve_attempts
    // must be exhausted AND now_ts past
    // last_activity_ts + UNDETERMINED_GRACE_SECONDS, where
    // last_activity_ts is resolved_ts if set, else evidence_submitted_ts,
    // else evidence_by_ts (the same fallback chain the contract uses).
    const undeterminedGrace = config?.undetermined_grace_seconds ?? 259200;
    const lastActivityTs = p.resolved_ts > 0 ? p.resolved_ts : p.evidence_submitted_ts > 0 ? p.evidence_submitted_ts : p.evidence_by_ts;
    const attemptsExhausted = p.resolve_attempts >= (config?.max_resolve_attempts ?? 5);
    if (attemptsExhausted && nowSec > lastActivityTs + undeterminedGrace) {
      actions.push({ kind: "force_refund_undetermined", label: "Force refund", description: "Adjudication attempts are exhausted and the grace period has passed — refund the creator since adjudication never converged.", variant: "outline", permissionless: true });
    }
  }

  if (p.status === "VERDICT_PENDING") {
    const contestWindowSeconds = config?.contest_window_seconds ?? 172800;
    const contestWindowOpen = nowSec <= p.resolved_ts + contestWindowSeconds;
    // Matches contest_verdict's exact checks: only while the contest
    // window is still open, and only once per promise (contest_count).
    if ((isCreator || isCounterparty) && contestWindowOpen && p.contest_count === 0) {
      actions.push({ kind: "contest", label: "Contest verdict", description: "Bond a contest fee to force a second, adversarial adjudication round.", variant: "outline" });
    }
    // Matches finalize_promise's exact check: only once the contest
    // window has passed.
    if (!contestWindowOpen) {
      actions.push({ kind: "finalize", label: "Finalize & pay out", description: "The contest window has passed — finalize and pay out per the verdict. Anyone may trigger this.", variant: "primary", permissionless: true });
    }
  }

  if (p.status === "CONTESTED") {
    actions.push({ kind: "resolve_contest", label: "Resolve contest", description: "Run the second adjudication round and finalize the outcome. Anyone may trigger this.", variant: "primary", permissionless: true });
  }

  return actions;
}
