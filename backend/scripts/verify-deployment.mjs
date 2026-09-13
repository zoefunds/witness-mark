#!/usr/bin/env node
// Deployment verification: proves (or disproves) that the contract source
// in this repo is byte-identical to what's actually deployed at the
// configured address, and that every method the source defines is present
// in the deployed schema. Run this after every deploy, and in CI, so
// source/deployment drift (like get_config() gaining fields the deployed
// instance doesn't have) is caught automatically instead of discovered
// by a user hitting a missing field months later.
//
// Usage: node scripts/verify-deployment.mjs [contractAddress]
// Falls back to GENLAYER_CONTRACT_ADDRESS / backend/.env if no arg given.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const contractPath = path.join(repoRoot, "contracts/witnessmark_contract.py");

function loadBackendEnvAddress() {
  const envPath = path.join(repoRoot, "backend/.env");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("GENLAYER_CONTRACT_ADDRESS="));
  return line ? line.split("=")[1]?.trim() : undefined;
}

function extractDecoratedMethods(source) {
  // Matches the same @gl.public.write / @gl.public.write.payable /
  // @gl.public.view decorator pattern used throughout the contract,
  // capturing the method name on the following `def` line.
  const methods = { write: [], view: [] };
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("@gl.public.write")) {
      const defLine = lines.slice(i + 1, i + 3).find((l) => l.trim().startsWith("def "));
      if (defLine) methods.write.push(defLine.trim().match(/def\s+(\w+)/)[1]);
    } else if (line.startsWith("@gl.public.view")) {
      const defLine = lines.slice(i + 1, i + 3).find((l) => l.trim().startsWith("def "));
      if (defLine) methods.view.push(defLine.trim().match(/def\s+(\w+)/)[1]);
    }
  }
  return methods;
}

async function main() {
  const address = process.argv[2] || process.env.GENLAYER_CONTRACT_ADDRESS || loadBackendEnvAddress();
  if (!address) {
    console.error("No contract address given (arg, GENLAYER_CONTRACT_ADDRESS, or backend/.env).");
    process.exit(2);
  }

  const localSource = readFileSync(contractPath, "utf-8");
  const localHash = createHash("sha256").update(localSource).digest("hex");
  let gitCommit = "unknown";
  try {
    gitCommit = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
  } catch {
    /* not fatal -- e.g. running outside a git checkout */
  }

  const client = createClient({ chain: studionet });

  console.log(`Verifying deployment at ${address} (chain ${studionet.id}, ${studionet.name})`);
  console.log(`Local source: ${contractPath}`);
  console.log(`  sha256: ${localHash}`);
  console.log(`  git commit: ${gitCommit}`);
  console.log("");

  let deployedSource, deployedSchema;
  try {
    [deployedSource, deployedSchema] = await Promise.all([
      client.getContractCode(address),
      client.getContractSchema(address),
    ]);
  } catch (err) {
    console.error(`FAIL: could not read deployed contract at ${address}: ${err.message}`);
    process.exit(1);
  }

  const deployedHash = createHash("sha256").update(deployedSource).digest("hex");
  const sourceMatches = deployedHash === localHash;

  console.log(`Deployed source sha256: ${deployedHash}`);
  console.log(`Source match: ${sourceMatches ? "YES -- byte-identical" : "NO -- see diff below"}`);
  console.log("");

  const localMethods = extractDecoratedMethods(localSource);
  const deployedMethodNames = new Set(Object.keys(deployedSchema.methods || {}));
  const deployedWrite = [...deployedMethodNames].filter((m) => deployedSchema.methods[m].readonly === false);
  const deployedView = [...deployedMethodNames].filter((m) => deployedSchema.methods[m].readonly === true);

  console.log(`Local source methods:    ${localMethods.write.length} write, ${localMethods.view.length} view`);
  console.log(`Deployed schema methods: ${deployedWrite.length} write, ${deployedView.length} view`);

  const missingOnChain = [...localMethods.write, ...localMethods.view].filter((m) => !deployedMethodNames.has(m));
  const extraOnChain = [...deployedMethodNames].filter(
    (m) => !localMethods.write.includes(m) && !localMethods.view.includes(m),
  );

  let ok = sourceMatches && missingOnChain.length === 0 && extraOnChain.length === 0;

  if (missingOnChain.length > 0) {
    console.log(`\nMethods in source but MISSING from deployed schema: ${missingOnChain.join(", ")}`);
  }
  if (extraOnChain.length > 0) {
    console.log(`\nMethods in deployed schema but NOT in source: ${extraOnChain.join(", ")}`);
  }

  if (!sourceMatches) {
    // A crude line-count/length diff summary -- good enough to flag drift
    // without shelling out to `diff` (which may not exist in a minimal CI
    // image), and to distinguish "differs at all" from "how much."
    console.log(
      `\nLength: deployed ${deployedSource.length} bytes vs local ${localSource.length} bytes ` +
        `(${localSource.length - deployedSource.length >= 0 ? "+" : ""}${localSource.length - deployedSource.length}).`,
    );
    console.log(
      "Run `diff <(node -e \"...getContractCode...\") contracts/witnessmark_contract.py` for the exact diff, " +
        "or see docs/deployment-manifest.md if this drift is already known/documented.",
    );
  }

  console.log(`\n${ok ? "PASS" : "FAIL"}: source/deployment ${ok ? "match" : "MISMATCH"} for ${address}`);
  process.exit(ok ? 0 : 1);
}

main();
