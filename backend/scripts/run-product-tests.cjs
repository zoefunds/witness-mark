/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { newAccount, write, read, GEN } = require("./wm-lib.cjs");

const REPORT = [];
function log(section, obj) {
  console.log(`\n=== ${section} ===`);
  console.log(JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  REPORT.push({ section, ...obj });
}

async function wcheck(label, account, fn, args, value) {
  const { hash, receipt } = await write(account, fn, args, value);
  const ok = receipt.status_name === "ACCEPTED";
  log(`WRITE ${label}: ${fn}`, { hash, status: receipt.status_name, result: receipt.result });
  if (!ok) throw new Error(`${label} (${fn}) did not reach ACCEPTED: ${receipt.status_name}`);
  return { hash, receipt };
}

async function main() {
  const accounts = {
    nexus: newAccount("Nexus Automation Labs"), // AI agent operator
    vertex: newAccount("Vertex Systems Inc."), // client
    meridian: newAccount("Meridian Components Ltd."), // supplier
    atlas: newAccount("Atlas Manufacturing Co."), // buyer
    orion: newAccount("Orion Creative Co."), // commissioner
    luma: newAccount("Luma Studio"), // illustrator
    kai: newAccount("Kai Chen"), // individual, personal accountability
    reyes: newAccount("Reyes Fitness Coaching"), // accountability partner
    watchdog: newAccount("Community Watchdog Bot"), // permissionless third party
  };
  log("ACCOUNTS", Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, v.address])));

  // ------------------------------------------------------------------
  // Scenario 4 setup happens FIRST so its 5-minute accept-window clock
  // runs concurrently with scenarios 1-3, instead of idly waiting later.
  // ------------------------------------------------------------------
  console.log("\n\n########## SCENARIO 4 SETUP (accept-window timeout) ##########");
  const s4 = await wcheck(
    "S4 create_promise",
    accounts.kai.account,
    "create_promise",
    [
      accounts.reyes.address,
      "30-Day Strength Program Accountability Stake",
      "Kai Chen stakes GEN behind completing a self-reported 30-day strength training program under Reyes Fitness Coaching's accountability plan, with Reyes as the named beneficiary if the commitment lapses unacknowledged.",
      "Reyes Fitness Coaching must formally accept this accountability arrangement within the acceptance window before the program clock starts. If Reyes does not accept in time, the arrangement never begins and Kai's stake is not truly at risk under an unaccepted commitment.",
      "N/A prior to acceptance.",
      "other",
      300, // MIN_ACCEPT_WINDOW_SECONDS -- deliberately the shortest allowed window
      1200,
    ],
    GEN / 20n, // 0.05 GEN
  );
  const s4CreatedAt = Date.now();
  const s4Id = Number(await read("get_promise_count")) - 1;
  log("S4 promise id", { id: s4Id });

  // ------------------------------------------------------------------
  // Scenario 1 -- AI Agent Software Delivery (verifiable work delivery,
  // WitnessMark's flagship vertical). Full lifecycle including a bonded
  // contest round to reach a fully-settled terminal state.
  // ------------------------------------------------------------------
  console.log("\n\n########## SCENARIO 1: AI Agent Software Delivery ##########");
  const s1Stake = GEN * 2n;
  const s1 = await wcheck(
    "S1 create_promise",
    accounts.nexus.account,
    "create_promise",
    [
      accounts.vertex.address,
      "AI Agent API Health-Check Endpoint Delivery",
      "Nexus Automation Labs' autonomous coding agent will deliver a publicly reachable, live HTTP health-check endpoint for Vertex Systems Inc.'s integration environment, confirming the agreed deployment succeeded.",
      "The submitted evidence URL must resolve to a live, publicly reachable HTML document returned with a successful HTTP status, demonstrating the endpoint is actually deployed and reachable -- not merely claimed in the delivery note.",
      "A direct link to the live deployed page. No screenshots or third-party claims accepted -- the contract fetches the URL itself.",
      "services",
      600,
      900,
    ],
    s1Stake,
  );
  const s1Id = Number(await read("get_promise_count")) - 1;
  log("S1 promise id", { id: s1Id });

  await wcheck("S1 accept_promise", accounts.vertex.account, "accept_promise", [s1Id]);

  await wcheck(
    "S1 submit_evidence",
    accounts.vertex.account,
    "submit_evidence",
    [
      s1Id,
      JSON.stringify(["https://httpbin.org/html"]),
      "Endpoint verified live via direct browser check and automated curl from our staging network prior to submission; httpbin's static HTML endpoint is used here as the stand-in deployment target agreed for this validation milestone.",
    ],
  );

  await wcheck("S1 resolve_promise", accounts.nexus.account, "resolve_promise", [s1Id]);
  let s1State = await read("get_promise", [s1Id]);
  log("S1 post-resolve state", { status: s1State.status, verdict_band: s1State.verdict_band, verdict_evidence_hash: s1State.verdict_evidence_hash });

  if (s1State.status === "VERDICT_PENDING") {
    const requiredBond = (BigInt(s1State.stake_wei) * 1500n) / 10000n;
    await wcheck("S1 contest_verdict", accounts.vertex.account, "contest_verdict", [s1Id], requiredBond);
    await wcheck("S1 resolve_contest", accounts.watchdog.account, "resolve_contest", [s1Id]);
  } else {
    log("S1 note", { note: `First resolve landed on ${s1State.status}, not VERDICT_PENDING -- skipping contest for this promise (a legitimate LLM outcome, not an error).` });
  }
  s1State = await read("get_promise", [s1Id]);
  log("S1 final state", s1State);

  // ------------------------------------------------------------------
  // Scenario 2 -- High-value procurement shipment (exercises the
  // domain-independent multi-source evidence rule: stake >= 1000 GEN
  // requires >= 2 evidence URLs on distinct registrable domains).
  // ------------------------------------------------------------------
  console.log("\n\n########## SCENARIO 2: High-Value Procurement Shipment ##########");
  const s2Stake = GEN * 1000n; // exactly HIGH_VALUE_STAKE_THRESHOLD_WEI
  const s2 = await wcheck(
    "S2 create_promise",
    accounts.meridian.account,
    "create_promise",
    [
      accounts.atlas.address,
      "Bulk Precision Component Shipment Conformance",
      "Meridian Components Ltd. promises that the shipment of precision-machined components dispatched to Atlas Manufacturing Co. matches the approved sample specification and is accompanied by a valid certificate of conformance.",
      "Independent, third-party-reachable documentation must corroborate BOTH that (a) a real shipment/tracking record exists for this consignment and (b) reference technical documentation for the specified component standard is genuinely publicly available, from two independently-hosted sources -- consistent with this promise's high-value, multi-source evidence requirement.",
      "At least two evidence URLs hosted on two different domains: one demonstrating shipment/tracking existence, one demonstrating the referenced technical standard is publicly documented.",
      "procurement",
      600,
      900,
    ],
    s2Stake,
  );
  const s2Id = Number(await read("get_promise_count")) - 1;
  log("S2 promise id", { id: s2Id });

  await wcheck("S2 accept_promise", accounts.atlas.account, "accept_promise", [s2Id]);

  await wcheck(
    "S2 submit_evidence",
    accounts.atlas.account,
    "submit_evidence",
    [
      s2Id,
      JSON.stringify(["https://httpbin.org/json", "https://www.w3.org/"]),
      "First source: shipment system response record (httpbin's stable JSON test endpoint stands in for our carrier's tracking API for this validation run). Second source, on a distinct domain: W3C's own site, standing in for the publicly documented technical standard reference required by this promise's evidence policy.",
    ],
  );

  await wcheck("S2 resolve_promise", accounts.meridian.account, "resolve_promise", [s2Id]);
  let s2State = await read("get_promise", [s2Id]);
  log("S2 post-resolve state", { status: s2State.status, verdict_band: s2State.verdict_band });

  if (s2State.status === "VERDICT_PENDING") {
    const requiredBond = (BigInt(s2State.stake_wei) * 1500n) / 10000n;
    await wcheck("S2 contest_verdict", accounts.meridian.account, "contest_verdict", [s2Id], requiredBond);
    await wcheck("S2 resolve_contest", accounts.watchdog.account, "resolve_contest", [s2Id]);
  } else {
    log("S2 note", { note: `First resolve landed on ${s2State.status}, not VERDICT_PENDING -- skipping contest for this promise.` });
  }
  s2State = await read("get_promise", [s2Id]);
  log("S2 final state", s2State);

  // ------------------------------------------------------------------
  // Scenario 3 -- Creative commission, cancelled pre-acceptance.
  // ------------------------------------------------------------------
  console.log("\n\n########## SCENARIO 3: Creative Commission (cancelled) ##########");
  const s3 = await wcheck(
    "S3 create_promise",
    accounts.orion.account,
    "create_promise",
    [
      accounts.luma.address,
      "Editorial Illustration Commission Deposit",
      "Orion Creative Co. stakes a commission deposit behind a planned editorial illustration package with Luma Studio, pending final scope confirmation.",
      "Final delivered artwork must match the agreed brief: three full-color editorial illustrations at the specified resolution, delivered as a public portfolio link.",
      "A link to the published illustration set.",
      "creative",
      600,
      900,
    ],
    GEN / 4n,
  );
  const s3Id = Number(await read("get_promise_count")) - 1;
  log("S3 promise id", { id: s3Id });

  await wcheck(
    "S3 cancel_promise",
    accounts.orion.account,
    "cancel_promise",
    [s3Id],
  );
  const s3State = await read("get_promise", [s3Id]);
  log("S3 final state", s3State);

  // ------------------------------------------------------------------
  // Scenario 4 finish -- wait out the accept window, then a THIRD party
  // (not creator or counterparty) permissionlessly reclaims the stake.
  // ------------------------------------------------------------------
  console.log("\n\n########## SCENARIO 4 FINISH (permissionless timeout reclaim) ##########");
  const elapsedMs = Date.now() - s4CreatedAt;
  const remainingMs = 300_000 - elapsedMs + 15_000; // +15s safety margin past the 300s window
  if (remainingMs > 0) {
    console.log(`Waiting ${Math.ceil(remainingMs / 1000)}s for the accept window to fully elapse...`);
    await new Promise((r) => setTimeout(r, remainingMs));
  }
  await wcheck(
    "S4 timeout_unaccepted_reclaim",
    accounts.watchdog.account,
    "timeout_unaccepted_reclaim",
    [s4Id],
  );
  const s4State = await read("get_promise", [s4Id]);
  log("S4 final state", s4State);

  // ------------------------------------------------------------------
  // Cross-cutting view-method exercise
  // ------------------------------------------------------------------
  console.log("\n\n########## VIEW METHODS ##########");
  log("get_promise_count", { value: await read("get_promise_count") });
  log("get_platform_stats", await read("get_platform_stats"));
  log("get_config", await read("get_config"));
  for (const [key, acc] of Object.entries(accounts)) {
    log(`get_party_promise_ids(${key})`, { address: acc.address, ids: await read("get_party_promise_ids", [acc.address]) });
  }
  for (const id of [s1Id, s2Id, s3Id, s4Id]) {
    log(`get_promise_summary(${id})`, await read("get_promise_summary", [id]));
    log(`get_activity(${id})`, { activity: await read("get_activity", [id, 0, 25]) });
  }
  log("get_reputation(nexus)", await read("get_reputation", [accounts.nexus.address]));
  log("get_reputation(meridian)", await read("get_reputation", [accounts.meridian.address]));
  log("get_reputation(orion)", await read("get_reputation", [accounts.orion.address]));
  log("get_reputation(kai)", await read("get_reputation", [accounts.kai.address]));

  fs.writeFileSync(
    path.join(__dirname, "product-test-report.json"),
    JSON.stringify({ accounts: Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, { label: v.label, address: v.address }])), promiseIds: { s1: s1Id, s2: s2Id, s3: s3Id, s4: s4Id }, log: REPORT }, null, 2),
  );
  console.log("\n\nAll scenarios completed successfully. Report written to scripts/product-test-report.json");
}

main().catch((err) => {
  console.error("\n\nFATAL:", err);
  fs.writeFileSync(
    path.join(__dirname, "product-test-report.json"),
    JSON.stringify({ error: String(err && err.stack || err), log: REPORT }, null, 2),
  );
  process.exit(1);
});
