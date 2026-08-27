import { describe, it, expect } from "vitest";
import { getAvailableActions } from "../lib/actions";
import type { PromiseRecord, ProtocolConfig } from "../lib/types";

// Matches the fallback constants getAvailableActions itself falls back to
// when no live config is passed -- kept in one place here so tests read
// as "N seconds before/after the boundary" rather than repeating magic
// numbers that would silently drift from the source if either changed
// independently.
const EVIDENCE_LATE_GRACE_SECONDS = 259200;
const UNDETERMINED_GRACE_SECONDS = 259200;
const CONTEST_WINDOW_SECONDS = 172800;
const MAX_RESOLVE_ATTEMPTS = 5;

const CREATOR = "0x1111111111111111111111111111111111111e";
const COUNTERPARTY = "0x2222222222222222222222222222222222222e";
const STRANGER = "0x3333333333333333333333333333333333333e";

function fakePromise(overrides: Partial<PromiseRecord> = {}): PromiseRecord {
  return {
    id: 0,
    creator: CREATOR,
    counterparty: COUNTERPARTY,
    title: "T",
    statement: "s",
    conditions: "c",
    evidence_requirements: "r",
    category: "goods",
    status: "CREATED",
    created_ts: 1000,
    accept_by_ts: 2000,
    evidence_by_ts: 3000,
    stake_wei: "1000000000000000000",
    stake_deposited_wei: "1000000000000000000",
    contest_bond_wei: "0",
    contest_bond_deposited_wei: "0",
    contester: "",
    evidence_urls: [],
    evidence_note: "",
    evidence_submitted_ts: 0,
    verdict_band: "NONE",
    creator_payout_bps: 0,
    verdict_reasoning: "",
    verdict_evidence_hash: "",
    final_band: "NONE",
    final_creator_payout_bps: 0,
    contest_outcome: "",
    resolve_attempts: 0,
    contest_count: 0,
    resolved_ts: 0,
    finalized_ts: 0,
    ...overrides,
  };
}

function kinds(actions: ReturnType<typeof getAvailableActions>) {
  return actions.map((a) => a.kind).sort();
}

describe("getAvailableActions — mirrors the contract's own access-control rules", () => {
  it("returns nothing for a disconnected wallet regardless of status", () => {
    expect(getAvailableActions(fakePromise(), undefined, 1500)).toEqual([]);
  });

  it("CREATED, before accept_by_ts: counterparty can accept, creator can cancel, no one else can", () => {
    const p = fakePromise({ status: "CREATED", accept_by_ts: 2000 });
    expect(kinds(getAvailableActions(p, COUNTERPARTY, 1500))).toEqual(["accept"]);
    expect(kinds(getAvailableActions(p, CREATOR, 1500))).toEqual(["cancel"]);
    expect(kinds(getAvailableActions(p, STRANGER, 1500))).toEqual([]);
  });

  it("CREATED, past accept_by_ts: the permissionless timeout reclaim becomes available to anyone connected", () => {
    const p = fakePromise({ status: "CREATED", accept_by_ts: 2000 });
    const actions = getAvailableActions(p, STRANGER, 2500);
    expect(kinds(actions)).toEqual(["timeout_unaccepted"]);
    expect(actions[0].permissionless).toBe(true);
  });

  it("CREATED, before accept_by_ts: the timeout action must NOT yet appear for anyone", () => {
    const p = fakePromise({ status: "CREATED", accept_by_ts: 2000 });
    expect(kinds(getAvailableActions(p, CREATOR, 1500))).not.toContain("timeout_unaccepted");
  });

  it("ACCEPTED: only the counterparty can submit evidence; case-insensitive address match", () => {
    const p = fakePromise({ status: "ACCEPTED" });
    expect(kinds(getAvailableActions(p, COUNTERPARTY.toUpperCase(), 1500))).toContain("submit_evidence");
    expect(kinds(getAvailableActions(p, CREATOR, 1500))).not.toContain("submit_evidence");
  });

  it("ACCEPTED: no-evidence reclaim requires evidence_by_ts + the late-submission grace period, NOT just evidence_by_ts", () => {
    // Regression test for a real bug: the UI previously offered this
    // reclaim immediately after evidence_by_ts, three days before the
    // contract's timeout_no_evidence_reclaim would actually allow it
    // (submit_evidence's own matching grace period means the counterparty
    // can still legitimately submit late evidence during that window) --
    // the transaction would have reverted on-chain.
    const p = fakePromise({ status: "ACCEPTED", evidence_by_ts: 3000 });

    // Right at evidence_by_ts: nothing yet.
    expect(kinds(getAvailableActions(p, STRANGER, 3000))).toEqual([]);
    // Just past evidence_by_ts but still within the grace period: still nothing.
    expect(kinds(getAvailableActions(p, STRANGER, 3000 + 100))).toEqual([]);
    expect(kinds(getAvailableActions(p, STRANGER, 3000 + EVIDENCE_LATE_GRACE_SECONDS))).toEqual([]);
    // Only once the grace period has fully elapsed does the reclaim appear.
    const actions = getAvailableActions(p, STRANGER, 3000 + EVIDENCE_LATE_GRACE_SECONDS + 1);
    expect(kinds(actions)).toEqual(["timeout_no_evidence"]);
    expect(actions[0].permissionless).toBe(true);
  });

  it("ACCEPTED: an explicit live config value for evidence_late_grace_seconds is honored over the fallback", () => {
    const p = fakePromise({ status: "ACCEPTED", evidence_by_ts: 1000 });
    const config = { evidence_late_grace_seconds: 60 } as ProtocolConfig;
    // Well within the FALLBACK grace, but past this shorter, live-config grace.
    expect(kinds(getAvailableActions(p, STRANGER, 1000 + 61, config))).toEqual(["timeout_no_evidence"]);
    expect(kinds(getAvailableActions(p, STRANGER, 1000 + 61))).toEqual([]); // no config passed -> fallback still applies
  });

  it("EVIDENCE_SUBMITTED: resolve is permissionless; only the counterparty may add more evidence", () => {
    const p = fakePromise({ status: "EVIDENCE_SUBMITTED" });
    const forStranger = getAvailableActions(p, STRANGER, 1500);
    expect(kinds(forStranger)).toEqual(["resolve"]);
    expect(forStranger.find((a) => a.kind === "resolve")!.permissionless).toBe(true);
    expect(kinds(getAvailableActions(p, COUNTERPARTY, 1500))).toEqual(["resolve", "submit_evidence"]);
  });

  it("UNDETERMINED: retry is offered while attempts remain; force-refund only once attempts are exhausted AND the grace period has passed", () => {
    // Attempts remain: retry only, no force-refund regardless of elapsed time.
    const stillRetryable = fakePromise({ status: "UNDETERMINED", resolve_attempts: 2, evidence_by_ts: 1000 });
    expect(kinds(getAvailableActions(stillRetryable, STRANGER, 1000 + UNDETERMINED_GRACE_SECONDS + 1))).toEqual(["resolve"]);

    // Attempts exhausted but grace period not yet elapsed: neither action.
    const exhaustedTooSoon = fakePromise({ status: "UNDETERMINED", resolve_attempts: MAX_RESOLVE_ATTEMPTS, evidence_by_ts: 1000 });
    expect(kinds(getAvailableActions(exhaustedTooSoon, STRANGER, 1000 + 100))).toEqual([]);

    // Attempts exhausted AND grace period elapsed: force-refund appears (retry does not, attempts are gone).
    const exhaustedAndGraced = fakePromise({ status: "UNDETERMINED", resolve_attempts: MAX_RESOLVE_ATTEMPTS, evidence_by_ts: 1000 });
    const actions = getAvailableActions(exhaustedAndGraced, STRANGER, 1000 + UNDETERMINED_GRACE_SECONDS + 1);
    expect(kinds(actions)).toEqual(["force_refund_undetermined"]);
    expect(actions.every((a) => a.permissionless)).toBe(true);
  });

  it("VERDICT_PENDING: contest is only offered to creator/counterparty while the contest window is open and unused; finalize only after it closes", () => {
    const p = fakePromise({ status: "VERDICT_PENDING", resolved_ts: 1000, contest_count: 0 });

    // Within the contest window: contest available to the two parties, nothing for a stranger, no finalize yet.
    const withinWindow = 1000 + CONTEST_WINDOW_SECONDS - 1;
    expect(kinds(getAvailableActions(p, CREATOR, withinWindow))).toEqual(["contest"]);
    expect(kinds(getAvailableActions(p, COUNTERPARTY, withinWindow))).toEqual(["contest"]);
    expect(kinds(getAvailableActions(p, STRANGER, withinWindow))).toEqual([]);

    // After the window closes: finalize becomes available to everyone, contest no longer offered.
    const afterWindow = 1000 + CONTEST_WINDOW_SECONDS + 1;
    const creatorActions = getAvailableActions(p, CREATOR, afterWindow);
    expect(kinds(creatorActions)).toEqual(["finalize"]);
    expect(creatorActions[0].permissionless).toBe(true);
    expect(kinds(getAvailableActions(p, STRANGER, afterWindow))).toEqual(["finalize"]);
  });

  it("VERDICT_PENDING: a promise that already used its one contest never offers contest again, even mid-window", () => {
    const p = fakePromise({ status: "VERDICT_PENDING", resolved_ts: 1000, contest_count: 1 });
    expect(kinds(getAvailableActions(p, CREATOR, 1000 + 10))).toEqual([]);
  });

  it("CONTESTED: resolve_contest is permissionless for anyone", () => {
    const p = fakePromise({ status: "CONTESTED" });
    expect(kinds(getAvailableActions(p, STRANGER, 1500))).toEqual(["resolve_contest"]);
  });

  it("terminal states (FULFILLED/BROKEN/CANCELLED/etc.) offer no actions to anyone", () => {
    for (const status of ["FULFILLED", "PARTIALLY_FULFILLED", "BROKEN", "CANCELLED", "TIMEOUT_UNACCEPTED"]) {
      const p = fakePromise({ status });
      expect(getAvailableActions(p, CREATOR, 1500)).toEqual([]);
      expect(getAvailableActions(p, COUNTERPARTY, 1500)).toEqual([]);
    }
  });
});
