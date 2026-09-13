"""
Multi-day timeout/recovery paths, exercised for REAL rather than only
having their premature-call rejection tested (which is all
test_witnessmark_lifecycle.py does for these three methods, by design --
see that file's own module docstring for exactly why: the real production
windows are measured in days, and no interactive/CI run should block for
days).

This file runs against a GENERATED, TEST-ONLY build of the contract
(_test_builds/long_timeout/witnessmark_contract.py, produced by
scripts/generate_shortened_test_contract.py) with exactly three duration
constants shortened from days/hours down to 45 seconds:
EVIDENCE_LATE_GRACE_SECONDS, UNDETERMINED_GRACE_SECONDS,
CONTEST_WINDOW_SECONDS. Every other line -- every function, every check,
every payout path -- is byte-identical to
contracts/witnessmark_contract.py; the generator script refuses to run
(non-zero exit) if it can't find and replace exactly those three named
constants, so this can't silently drift into testing different logic than
production. Production's own deploy is never affected: this generated
file is gitignored and deployed only to its own disposable, ephemeral
StudioNet instance, by this test file's own gltest fixture, never to any
address the application configuration points at.

Run:
    python3 scripts/generate_shortened_test_contract.py \
        > _test_builds/long_timeout/witnessmark_contract.py
    gltest --contracts-dir _test_builds/long_timeout \
           --artifacts-dir artifacts_long_timeout \
           tests/integration/test_long_timeout_recovery.py -v -s

Intended to run on a schedule (see .github/workflows/long-timeout-tests.yml,
`schedule` + `workflow_dispatch` triggers) rather than on every push --
each test here spends real wall-clock time sleeping out its (shortened)
window, so the whole file takes several minutes.
"""

import json
import time

import pytest
from gltest import get_contract_factory, get_accounts, create_account
from gltest.assertions import tx_execution_succeeded

GEN = 10**18


def deploy_contract():
    factory = get_contract_factory("WitnessMark")
    return factory.deploy(args=[])


def get_promise(contract, promise_id: int) -> dict:
    return contract.get_promise(args=[promise_id]).call()


@pytest.fixture()
def accounts():
    accs = get_accounts()
    assert len(accs) >= 2
    return accs


@pytest.fixture()
def contract():
    return deploy_contract()


def test_shortened_build_config_confirms_the_override(contract):
    """Sanity check that we're actually talking to the shortened build,
    not accidentally the production contract (which would make every
    other test in this file take days)."""
    config = contract.get_config(args=[]).call()
    assert config["evidence_late_grace_seconds"] == 45, (
        "expected the TEST-ONLY shortened build (45s), got production's value -- "
        "did you forget to regenerate _test_builds/long_timeout/witnessmark_contract.py, "
        "or point --contracts-dir at the wrong directory?"
    )
    assert config["undetermined_grace_seconds"] == 45
    assert config["contest_window_seconds"] == 45
    # Everything NOT in the override list must still match production exactly.
    assert config["contest_bond_bps"] == 1500
    assert config["max_resolve_attempts"] == 5
    assert config["min_accept_window_seconds"] == 300


@pytest.mark.slow
def test_timeout_no_evidence_reclaim_succeeds_after_the_real_grace_period(contract, accounts):
    """Full real-time exercise of the 3-day (here: 45s) evidence grace
    period: submit no evidence, wait out evidence_by_ts + the shortened
    EVIDENCE_LATE_GRACE_SECONDS for real, then confirm the permissionless
    reclaim actually succeeds -- not just that calling it too early
    reverts (already covered in the fast suite)."""
    creator, counterparty, stranger = accounts[0], accounts[1], create_account()
    contract.account = creator
    contract.create_promise(
        args=[counterparty.address, "T", "s", "c", "r", "goods", 300, 300]
    ).transact(value=1 * GEN)
    contract.account = counterparty
    contract.accept_promise(args=[0]).transact()

    p = get_promise(contract, 0)
    evidence_by_ts = p["evidence_by_ts"]

    # Sleep past evidence_by_ts + the shortened 45s grace, with margin for
    # clock skew between this machine and the chain's own block time.
    now = int(time.time())
    sleep_seconds = max(0, (evidence_by_ts - now) + 45 + 15)
    time.sleep(sleep_seconds)

    contract.account = stranger
    receipt = contract.timeout_no_evidence_reclaim(args=[0]).transact()
    assert tx_execution_succeeded(receipt)
    assert get_promise(contract, 0)["status"] == "TIMEOUT_NO_EVIDENCE"


@pytest.mark.slow
def test_force_refund_undetermined_succeeds_after_real_exhaustion_and_grace(contract, accounts):
    """Full real-time exercise of force_refund_undetermined: submit
    evidence that reliably lands on UNDETERMINED (an unfetchable URL,
    same fixture as the fast suite's dead-link test), exhaust all 5
    resolve attempts for real, wait out the shortened
    UNDETERMINED_GRACE_SECONDS, then confirm the refund actually
    succeeds."""
    creator, counterparty = accounts[0], accounts[1]
    contract.account = creator
    contract.create_promise(
        args=[counterparty.address, "T", "s", "c", "r", "goods", 300, 300]
    ).transact(value=1 * GEN)
    contract.account = counterparty
    contract.accept_promise(args=[0]).transact()
    contract.submit_evidence(
        args=[0, json.dumps(["https://httpbin.org/status/404"]), ""]
    ).transact()

    contract.account = creator
    last_resolved_ts = 0
    for attempt in range(5):
        receipt = contract.resolve_promise(args=[0]).transact()
        assert tx_execution_succeeded(receipt)
        p = get_promise(contract, 0)
        assert p["status"] == "UNDETERMINED", f"attempt {attempt + 1}: expected UNDETERMINED, got {p['status']}"
        assert p["resolve_attempts"] == attempt + 1
        last_resolved_ts = int(time.time())

    now = int(time.time())
    sleep_seconds = max(0, (last_resolved_ts - now) + 45 + 15)
    time.sleep(sleep_seconds)

    receipt = contract.force_refund_undetermined(args=[0]).transact()
    assert tx_execution_succeeded(receipt)
    assert get_promise(contract, 0)["status"] == "TIMEOUT_UNDETERMINED_REFUND"


@pytest.mark.slow
def test_finalize_promise_succeeds_after_the_real_contest_window(contract, accounts):
    """Full real-time exercise of finalize_promise's own 48h (here: 45s)
    contest window -- the one settlement path NOT covered by the
    contest_verdict/resolve_contest route used elsewhere in this test
    suite and in docs/live-product-tests.md. Resolves a promise, then
    waits out the real (shortened) contest window with NO contest filed,
    and confirms finalize_promise pays out per the recorded verdict."""
    creator, counterparty = accounts[0], accounts[1]
    contract.account = creator
    contract.create_promise(
        args=[counterparty.address, "T", "s", "c", "r", "goods", 300, 300]
    ).transact(value=1 * GEN)
    contract.account = counterparty
    contract.accept_promise(args=[0]).transact()
    contract.submit_evidence(
        args=[0, json.dumps(["https://httpbin.org/html"]), ""]
    ).transact()

    contract.account = creator
    receipt = contract.resolve_promise(args=[0]).transact()
    assert tx_execution_succeeded(receipt)
    p = get_promise(contract, 0)
    if p["status"] != "VERDICT_PENDING":
        pytest.skip(
            f"adjudication did not converge to a verdict this run (status={p['status']}); "
            "not a finalize_promise-path failure, LLM sampling variance on this fixture -- "
            "see tests/integration/test_witnessmark_lifecycle.py's equivalent note."
        )

    resolved_ts = p["resolved_ts"]
    now = int(time.time())
    sleep_seconds = max(0, (resolved_ts - now) + 45 + 15)
    time.sleep(sleep_seconds)

    receipt = contract.finalize_promise(args=[0]).transact()
    assert tx_execution_succeeded(receipt)
    final = get_promise(contract, 0)
    assert final["status"] in ("FULFILLED", "PARTIALLY_FULFILLED", "BROKEN")
    assert final["stake_deposited_wei"] == 0, "finalize_promise must fully drain the escrowed stake"
