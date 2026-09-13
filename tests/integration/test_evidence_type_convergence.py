"""
Broader empirical convergence measurements across evidence TYPES, extending
test_witnessmark_lifecycle.py's test_empirical_verdict_convergence_on_fixed_evidence
(which only samples one evidence fixture, the one that reliably yields
FULFILLED) to also sample fixtures that reliably lean BROKEN and PARTIALLY_FULFILLED,
each at a larger N. Like that test, these are NOT pass/fail correctness
assertions on the exact band -- they are measurements of how consistently
independent adjudication rounds converge on the same substantive judgment for
a fixed input, run with -s to keep the printed distributions as evidence.

Deliberately NOT attempted here: a "changed evidence" / fully-ambiguous
evidence-type sweep. Constructing evidence that shifts BETWEEN resolve
attempts (to exercise resolve_promise's re-fetch-and-re-adjudicate path under
genuinely changing input, as opposed to a static unfetchable link) needs a
controlled mutable evidence server -- httpbin.org and similar static test
endpoints can't do this. That gap is intentional and documented here rather
than faked with a fixture that doesn't actually change.
"""

import json

import pytest
from gltest import get_contract_factory, get_accounts
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


def _sample_bands(contract, creator, counterparty, statement, conditions, requirements, evidence_urls, n_samples):
    bands = []
    for i in range(n_samples):
        contract.account = creator
        contract.create_promise(
            args=[counterparty.address, f"sample {i}", statement, conditions, requirements, "goods", 600, 600]
        ).transact(value=1 * GEN)
        contract.account = counterparty
        contract.accept_promise(args=[i]).transact()
        contract.submit_evidence(args=[i, json.dumps(evidence_urls), ""]).transact()
        contract.account = creator
        receipt = contract.resolve_promise(args=[i]).transact()
        assert tx_execution_succeeded(receipt), f"sample {i}: resolve_promise itself must not revert"
        p = get_promise(contract, i)
        bands.append(p["status"] if p["status"] != "VERDICT_PENDING" else p["verdict_band"])
    return bands


@pytest.mark.slow
def test_convergence_on_evidence_that_clearly_fails_the_condition(contract, accounts):
    """Evidence type: a real, live, fetchable page that plainly does not
    satisfy a specific, checkable textual condition. Expected to converge
    on BROKEN (an unfetchable link would be UNDETERMINED instead -- see
    test_resolve_promise_with_dead_evidence_link_is_undetermined -- this
    fixture is deliberately fetchable so BROKEN is actually reachable)."""
    creator, counterparty = accounts[0], accounts[1]
    bands = _sample_bands(
        contract,
        creator,
        counterparty,
        statement="The delivered report contains the exact verification code ZX9-CONFIRM-77.",
        conditions=(
            "The fetched evidence page must literally contain the substring "
            "'ZX9-CONFIRM-77'. It does not appear anywhere in the evidence used "
            "by this test -- a correct adjudicator must therefore find the "
            "condition NOT satisfied."
        ),
        requirements="A page containing the exact verification code string.",
        evidence_urls=["https://httpbin.org/html"],
        n_samples=5,
    )
    print(f"\n[broken-leaning evidence] n=5 observed_bands={bands}")
    assert len(bands) == 5, "every sample must reach SOME recorded outcome (never silently hang)"


@pytest.mark.slow
def test_convergence_on_evidence_that_partially_satisfies_two_conditions(contract, accounts):
    """Evidence type: a real, live, fetchable page that satisfies ONE of
    two explicitly stated sub-conditions but not the other. This is the
    fixture most likely to produce genuine PARTIALLY_FULFILLED verdicts
    (as opposed to a strict adjudicator collapsing it to BROKEN) -- the
    distribution itself is the interesting empirical result, since it
    speaks to how the adjudicator handles compound/partial conditions
    rather than to a specific pass/fail contract behavior."""
    creator, counterparty = accounts[0], accounts[1]
    bands = _sample_bands(
        contract,
        creator,
        counterparty,
        statement="The delivered page is both (a) a live public HTML document, and (b) contains the exact code ZX9-CONFIRM-77.",
        conditions=(
            "TWO conditions must both hold for full satisfaction: "
            "(a) the evidence URL must resolve to a real, live, publicly "
            "reachable HTML document, and "
            "(b) that document's content must literally contain the substring "
            "'ZX9-CONFIRM-77'. "
            "The evidence used by this test satisfies (a) but not (b): it is a "
            "genuine live HTML page, but the exact code string does not appear "
            "in it anywhere."
        ),
        requirements="A live HTML page containing the exact verification code string.",
        evidence_urls=["https://httpbin.org/html"],
        n_samples=5,
    )
    print(f"\n[partial-leaning evidence] n=5 observed_bands={bands}")
    assert len(bands) == 5, "every sample must reach SOME recorded outcome (never silently hang)"
