// Central status / band vocabulary mirrored from
// contracts/witnessmark_contract.py (STATUS_NAMES / BAND_NAMES). Keep in
// sync with that file — do not invent new statuses here.

export const PROMISE_STATUSES = [
  "CREATED",
  "ACCEPTED",
  "EVIDENCE_SUBMITTED",
  "UNDETERMINED",
  "VERDICT_PENDING",
  "CONTESTED",
  "FULFILLED",
  "PARTIALLY_FULFILLED",
  "BROKEN",
  "CANCELLED",
  "TIMEOUT_UNACCEPTED",
  "TIMEOUT_NO_EVIDENCE",
  "TIMEOUT_UNDETERMINED_REFUND",
] as const;

export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const VERDICT_BANDS = [
  "NONE",
  "FULFILLED",
  "PARTIALLY_FULFILLED",
  "BROKEN",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type VerdictBand = (typeof VERDICT_BANDS)[number];

export const TERMINAL_STATUSES: PromiseStatus[] = [
  "FULFILLED",
  "PARTIALLY_FULFILLED",
  "BROKEN",
  "CANCELLED",
  "TIMEOUT_UNACCEPTED",
  "TIMEOUT_NO_EVIDENCE",
  "TIMEOUT_UNDETERMINED_REFUND",
];

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as PromiseStatus);
}

// Plain-English explanation of each status — what's happening and what
// happens financially next. Shown on the promise detail page per the UX
// principle in WITNESSMARK.md section 52.
export const STATUS_EXPLANATIONS: Record<PromiseStatus, { label: string; description: string; financial: string; tone: "neutral" | "pending" | "success" | "warning" | "error" }> = {
  CREATED: {
    label: "Awaiting acceptance",
    description: "The creator has staked GEN behind this promise. The counterparty must accept it before it becomes binding.",
    financial: "Stake is held in escrow by the contract. If the counterparty never accepts, the creator can reclaim it once the accept window passes.",
    tone: "pending",
  },
  ACCEPTED: {
    label: "Accepted, awaiting evidence",
    description: "The counterparty has accepted the promise. They now need to submit evidence once the real-world outcome is known.",
    financial: "Stake remains in escrow. If no evidence is submitted before the evidence window closes, the creator can reclaim the stake.",
    tone: "pending",
  },
  EVIDENCE_SUBMITTED: {
    label: "Evidence submitted",
    description: "Evidence has been submitted and is awaiting adjudication by the GenLayer Intelligent Contract.",
    financial: "Stake remains in escrow. Anyone may permissionlessly trigger adjudication.",
    tone: "pending",
  },
  UNDETERMINED: {
    label: "Adjudication inconclusive",
    description: "A prior adjudication attempt could not reach consensus. It can be retried, or refunded after a grace period.",
    financial: "Stake remains in escrow pending a retry, or the creator may reclaim it after the undetermined grace period.",
    tone: "warning",
  },
  VERDICT_PENDING: {
    label: "Verdict recorded — contest window open",
    description: "GenLayer has reached a verdict. Either party may contest it within the contest window before it finalizes.",
    financial: "Payout is determined but not yet sent. Funds remain escrowed until the contest window passes or a contest resolves.",
    tone: "pending",
  },
  CONTESTED: {
    label: "Verdict contested",
    description: "A party has bonded a contest fee to force a second, adversarial adjudication round.",
    financial: "Stake and contest bond are both escrowed pending the second adjudication.",
    tone: "warning",
  },
  FULFILLED: {
    label: "Fulfilled",
    description: "GenLayer determined the promise was kept in full.",
    financial: "The full stake has been returned to the creator.",
    tone: "success",
  },
  PARTIALLY_FULFILLED: {
    label: "Partially fulfilled",
    description: "GenLayer determined the promise was partially kept.",
    financial: "The stake was split between creator and counterparty according to the recorded payout percentage.",
    tone: "warning",
  },
  BROKEN: {
    label: "Broken",
    description: "GenLayer determined the promise was not kept.",
    financial: "The full stake was paid out to the counterparty.",
    tone: "error",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "The creator cancelled this promise before the counterparty accepted it.",
    financial: "The full stake was refunded to the creator.",
    tone: "neutral",
  },
  TIMEOUT_UNACCEPTED: {
    label: "Expired — never accepted",
    description: "The counterparty never accepted the promise within the accept window.",
    financial: "The full stake was reclaimed by the creator.",
    tone: "neutral",
  },
  TIMEOUT_NO_EVIDENCE: {
    label: "Expired — no evidence submitted",
    description: "The counterparty never submitted evidence within the evidence window.",
    financial: "The full stake was reclaimed by the creator.",
    tone: "neutral",
  },
  TIMEOUT_UNDETERMINED_REFUND: {
    label: "Refunded — adjudication never converged",
    description: "Adjudication could not reach a consensus verdict even after retries, and the grace period elapsed.",
    financial: "The full stake was refunded to the creator.",
    tone: "neutral",
  },
};

export const STATUS_TONE_CLASSES: Record<string, string> = {
  neutral: "bg-surface-container text-on-surface-variant",
  pending: "bg-tertiary-container text-on-tertiary-container",
  success: "bg-secondary-container text-on-secondary-container",
  warning: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error-container text-on-error-container",
};

// "procurement" listed first: the primary, documented use case (see
// README.md and docs/live-product-tests.md's Scenario 2) — also the
// default selected in the create-promise wizard.
export const CATEGORY_OPTIONS = [
  "procurement",
  "goods",
  "services",
  "creative",
  "employment",
  "logistics",
  "financial",
  "other",
];
