#!/usr/bin/env python3
"""
Generates a TEST-ONLY variant of the WitnessMark contract with drastically
shortened real-time windows, so the multi-day/48h timeout and recovery
paths (timeout_no_evidence_reclaim, force_refund_undetermined,
finalize_promise) can actually be exercised end-to-end in a CI-length run
instead of only having their premature-call REJECTION path tested (which
is all tests/integration/test_witnessmark_lifecycle.py does for these
three, by design -- see that file's own module docstring).

This is NOT a second contract in the application sense (WITNESSMARK.md's
single-contract constraint is about contracts/witnessmark_contract.py,
the one that's ever deployed to StudioNet for real use) -- it is a
disposable, generated-on-demand test fixture, deployed only by
tests/integration/test_long_timeout_recovery.py's own gltest fixture to
its own ephemeral instance, never to any address the app configuration
ever points at. It is derived mechanically (regex substitution over
KNOWN constant assignment lines only) from the real contract source, so
it cannot silently drift into testing different LOGIC than production --
only the numeric duration constants differ, and exactly which ones are
listed explicitly below.

Usage:
    python3 scripts/generate_shortened_test_contract.py \
        > _test_builds/long_timeout/witnessmark_contract.py

IMPORTANT: the output must land OUTSIDE contracts/ entirely, not in a
subdirectory of it. gltest's default get_contract_factory("WitnessMark")
searches its configured contracts directory RECURSIVELY (rglob) for any
file defining a class named WitnessMark -- a generated copy sitting
anywhere under contracts/, even nested, makes that search find two
matches and breaks every test in the main suite with "Multiple contracts
named 'WitnessMark' found" (this was hit for real while building this
generator, the first design put the output at
contracts/_long_timeout_test_build/, and it broke
tests/integration/test_witnessmark_lifecycle.py the moment the generated
file existed on disk). _test_builds/ is a sibling of contracts/, entirely
outside its search root, so no such collision can occur regardless of
what's generated inside it.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "contracts" / "witnessmark_contract.py"

# Only these three constants are overridden. Every other line of the
# contract -- every function, every check, every payout path -- is
# byte-identical to production. Values chosen to be long enough to
# reliably distinguish "before" from "after" in a real test run, short
# enough to finish in well under CI's job timeout.
OVERRIDES = {
    "EVIDENCE_LATE_GRACE_SECONDS": 45,
    "UNDETERMINED_GRACE_SECONDS": 45,
    "CONTEST_WINDOW_SECONDS": 45,
}


def generate() -> str:
    source = SOURCE.read_text()
    applied = set()

    def replace_constant(match: re.Match) -> str:
        name = match.group(1)
        if name in OVERRIDES:
            applied.add(name)
            original_line = match.group(0)
            return (
                f"{name} = {OVERRIDES[name]}"
                f"  # TEST-BUILD OVERRIDE (was: {original_line.split('=', 1)[1].split('#')[0].strip()}) "
                f"-- see scripts/generate_shortened_test_contract.py"
            )
        return match.group(0)

    pattern = re.compile(r"^(" + "|".join(OVERRIDES.keys()) + r")\s*=\s*\d+.*$", re.MULTILINE)
    result = pattern.sub(replace_constant, source)

    missing = set(OVERRIDES.keys()) - applied
    if missing:
        raise SystemExit(
            f"generate_shortened_test_contract.py: expected constant(s) not found in source "
            f"(contract source may have changed): {sorted(missing)}. Refusing to emit a silently "
            f"unmodified 'shortened' build."
        )

    banner = (
        "# ============================================================================\n"
        "# GENERATED TEST-ONLY BUILD -- DO NOT DEPLOY. See scripts/\n"
        "# generate_shortened_test_contract.py. Every override applied:\n"
        + "\n".join(f"#   {k} -> {v}s (production: see contracts/witnessmark_contract.py)" for k, v in OVERRIDES.items())
        + "\n# Everything else in this file is byte-identical to production source.\n"
        "# ============================================================================\n"
    )
    # GenVM requires its runtime-version/Depends pragma comments to be the
    # very first lines of the file -- prepending the banner ahead of them
    # breaks deployment (leader ERROR, empty stdout/stderr) because GenVM
    # can no longer find the pragma. So the pragma lines (source's line 1
    # and 2) must stay first; the banner goes right after them instead.
    lines = result.split("\n", 2)
    pragma, rest = "\n".join(lines[:2]), lines[2] if len(lines) > 2 else ""
    return f"{pragma}\n\n{banner}\n{rest}"


if __name__ == "__main__":
    sys.stdout.write(generate())
