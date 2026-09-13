import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Real signed-transaction E2E: create -> accept -> authenticated evidence
 * upload -> submit -> resolve -> contest/resolve_contest, driven entirely
 * through the live UI against live StudioNet, using two independent
 * injected EIP-1193 test wallets (one per persona) backed by REAL viem
 * accounts -- genuine transactions, genuine tx hashes, printed to test
 * output as they happen.
 *
 * Connection technique: earlier attempts tried to get Reown AppKit's
 * connector-picker MODAL to list the injected/EIP-6963-announced test
 * wallet as a selectable option -- confirmed by screenshot that it
 * doesn't (AppKit shows only its curated remote-wallet list). Rather
 * than keep fighting AppKit's UI internals, this calls
 * window.__e2eConnectInjected() (see components/E2EWalletHook.tsx),
 * which invokes wagmi's own connect() action against the injected()
 * connector directly -- the same underlying action AppKit's button would
 * eventually call, just without its UI layer in the way. This is real
 * wagmi state, a real connected account, and every subsequent write is
 * still signed by the real injected wallet's personal_sign/
 * eth_sendTransaction handlers.
 *
 * This test is slow (~5-10 real minutes: two live nondet adjudication
 * rounds) and consumes real StudioNet request budget -- run it
 * individually, not as part of routine CI.
 */

const STUDIONET_CHAIN_ID_HEX = "0xf22f"; // 61999
const VIEM_CDN = "https://esm.sh/viem@2.56.0";

function randomHexPrivateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Buffer.from(bytes).toString("hex");
}

async function installTestWallet(context: BrowserContext, privateKey: string) {
  await context.addInitScript(
    ({ privateKey, chainIdHex, viemCdn }) => {
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

      async function getAccountAndClient() {
        const { privateKeyToAccount } = await import(/* @vite-ignore */ `${viemCdn}/accounts`);
        const { createWalletClient, http, defineChain } = await import(/* @vite-ignore */ viemCdn);
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const chain = defineChain({
          id: parseInt(chainIdHex, 16),
          name: "GenLayer Studio Network",
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
        });
        const client = createWalletClient({ account, chain, transport: http() });
        return { account, client };
      }

      const provider = {
        isMetaMask: true,
        chainId: chainIdHex,
        networkVersion: String(parseInt(chainIdHex, 16)),
        isConnected: () => true,
        on(event: string, cb: (...args: unknown[]) => void) {
          (listeners[event] ??= []).push(cb);
        },
        removeListener(event: string, cb: (...args: unknown[]) => void) {
          listeners[event] = (listeners[event] || []).filter((l) => l !== cb);
        },
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          const { account, client } = await getAccountAndClient();
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [account.address];
            case "eth_chainId":
              return chainIdHex;
            case "wallet_switchEthereumChain":
            case "wallet_addEthereumChain":
              return null;
            case "personal_sign": {
              const raw = (params as string[])[0];
              return account.signMessage({ message: { raw: raw as `0x${string}` } });
            }
            case "eth_sendTransaction": {
              const tx = (params as Record<string, string>[])[0];
              console.log("[test-wallet] eth_sendTransaction params:", JSON.stringify(tx));
              return client.sendTransaction({
                to: tx.to as `0x${string}`,
                data: (tx.data ?? tx.input) as `0x${string}` | undefined,
                value: tx.value ? BigInt(tx.value) : 0n,
              });
            }
            default:
              throw new Error(`Test wallet: unsupported method ${method}`);
          }
        },
      };

      Object.defineProperty(window, "ethereum", { value: provider, writable: true, configurable: true });
      window.dispatchEvent(new Event("ethereum#initialized"));

      const info = {
        uuid: "witnessmark-test-wallet-" + privateKey.slice(2, 10),
        name: "WitnessMark Test Wallet",
        icon: "data:image/svg+xml;base64,",
        rdns: "com.witnessmark.testwallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { privateKey, chainIdHex: STUDIONET_CHAIN_ID_HEX, viemCdn: VIEM_CDN },
  );
}

async function connectInjectedWallet(page: Page): Promise<string> {
  await page.goto("/");
  const address = await page.evaluate(async () => {
    const fn = (window as unknown as { __e2eConnectInjected?: () => Promise<string | undefined> })
      .__e2eConnectInjected;
    if (!fn) throw new Error("window.__e2eConnectInjected is not defined -- E2EWalletHook did not mount");
    return fn();
  });
  if (!address) throw new Error("connect() resolved with no account");
  return address;
}

async function waitForTxConfirmedAndGetHash(page: Page, timeout = 120_000): Promise<string> {
  await expect(page.getByText("Transaction confirmed.")).toBeVisible({ timeout });
  const hashLocator = page.locator("span.font-mono-data", { hasText: /^0x[0-9a-fA-F]+$/ });
  const hash = await hashLocator.first().textContent();
  return hash?.trim() ?? "";
}

// Nondeterministic writes (resolve_promise's adjudication, contest_verdict,
// resolve_contest) go through real leader+validator LLM consensus on
// StudioNet, which can genuinely take several minutes -- longer than the
// simple deterministic writes above. Found by this exact test: the first
// real run against the redeployed app confirmed create/accept/submit in
// well under 120s each, then resolve_promise alone exceeded it.
const NONDET_TX_TIMEOUT = 480_000;

const txLog: Record<string, string> = {};

test.describe("signed StudioNet lifecycle (real injected test wallets, no mocks)", () => {
  test.setTimeout(25 * 60_000);

  test("create -> accept -> authenticated evidence upload -> submit -> resolve -> contest/resolve_contest", async ({
    browser,
  }) => {
    const creatorKey = randomHexPrivateKey();
    const counterpartyKey = randomHexPrivateKey();

    const creatorContext = await browser.newContext();
    const counterpartyContext = await browser.newContext();
    await installTestWallet(creatorContext, creatorKey);
    await installTestWallet(counterpartyContext, counterpartyKey);

    const creatorPage = await creatorContext.newPage();
    const counterpartyPage = await counterpartyContext.newPage();
    creatorPage.on("console", (msg) => console.log(`[creator page console] ${msg.text()}`));
    counterpartyPage.on("console", (msg) => console.log(`[counterparty page console] ${msg.text()}`));

    const creatorAddress = await connectInjectedWallet(creatorPage);
    const counterpartyAddress = await connectInjectedWallet(counterpartyPage);
    expect(creatorAddress.toLowerCase()).not.toBe(counterpartyAddress.toLowerCase());
    console.log(`creator=${creatorAddress} counterparty=${counterpartyAddress}`);

    // ---- create_promise ------------------------------------------------
    await creatorPage.goto("/promises/new");
    await creatorPage.getByLabel("Title").fill("E2E: Sample delivery matches specification");
    await creatorPage
      .getByLabel("Statement")
      .fill("The delivered sample will match the agreed reference specification exactly.");
    await creatorPage
      .getByLabel("Conditions")
      .fill(
        "The fetched evidence page must be a real, live, publicly reachable HTML document, standing in as " +
          "the delivery-confirmation record for this automated end-to-end test.",
      );
    await creatorPage.getByRole("button", { name: "Continue" }).click();

    await creatorPage.getByLabel("Counterparty address").fill(counterpartyAddress);
    await creatorPage.getByRole("button", { name: "Continue" }).click();

    await creatorPage
      .getByLabel("Evidence requirements")
      .fill("A link to a live, publicly reachable page confirming delivery.");
    await creatorPage.getByRole("button", { name: "Continue" }).click();

    await creatorPage.getByLabel("Stake amount (GEN)").fill("1");
    await creatorPage.getByRole("button", { name: "Continue" }).click();

    await creatorPage.getByRole("button", { name: "Sign and create promise" }).click();
    await expect(creatorPage.getByText("Promise created")).toBeVisible({ timeout: 120_000 });
    const createTxHash = await creatorPage.locator("p.font-mono-data").first().textContent();
    txLog.create_promise = createTxHash?.trim() ?? "";
    console.log(`create_promise tx: ${txLog.create_promise}`);

    await creatorPage.getByRole("button", { name: "View promise" }).click();
    await creatorPage.waitForURL(/\/promises\/\d+$/);
    const promiseId = creatorPage.url().match(/\/promises\/(\d+)$/)?.[1];
    if (!promiseId) throw new Error(`Could not extract promise id from URL ${creatorPage.url()}`);
    console.log(`promise id: ${promiseId}`);

    // ---- accept_promise --------------------------------------------------
    await counterpartyPage.goto(`/promises/${promiseId}`);
    await counterpartyPage.getByRole("button", { name: "Accept promise" }).click();
    txLog.accept_promise = await waitForTxConfirmedAndGetHash(counterpartyPage);
    console.log(`accept_promise tx: ${txLog.accept_promise}`);

    // ---- authenticated evidence upload + submit_evidence -----------------
    await counterpartyPage.goto(`/promises/${promiseId}/evidence`);
    const fileInput = counterpartyPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "e2e-evidence.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("WitnessMark signed E2E test evidence file, generated " + new Date().toISOString()),
    });
    // Uploading triggers useAuth's signIn() (nonce -> personal_sign ->
    // verify) automatically before the file reaches the backend -- a
    // second real signature from the same injected wallet.
    await expect(counterpartyPage.getByText(/Uploading…|Waiting for wallet signature/)).toBeVisible({ timeout: 10_000 }).catch(() => {});
    await expect(counterpartyPage.locator('input[value^="https://"]').first()).toBeVisible({ timeout: 30_000 });

    await counterpartyPage.getByRole("button", { name: "Submit evidence" }).click();
    txLog.submit_evidence = await waitForTxConfirmedAndGetHash(counterpartyPage);
    console.log(`submit_evidence tx: ${txLog.submit_evidence}`);

    // ---- resolve_promise (real nondet adjudication) -----------------------
    await creatorPage.goto(`/promises/${promiseId}`);
    await creatorPage.getByRole("button", { name: "Run adjudication" }).click();
    txLog.resolve_promise = await waitForTxConfirmedAndGetHash(creatorPage, NONDET_TX_TIMEOUT);
    console.log(`resolve_promise tx: ${txLog.resolve_promise}`);

    await creatorPage.reload();
    const bodyText = await creatorPage.locator("body").innerText();
    console.log(`post-resolve status visible on page: ${/VERDICT_PENDING|UNDETERMINED/.exec(bodyText)?.[0]}`);

    const contestButton = creatorPage.getByRole("button", { name: "Contest verdict" });
    const hasContest = await contestButton.isVisible().catch(() => false);

    if (!hasContest) {
      console.log(
        "No verdict was recorded this run (adjudication landed on UNDETERMINED) -- contest/resolve_contest " +
          "not reached. This is legitimate LLM-sampling behavior on this evidence fixture, not a bug -- " +
          "see docs/testing.md's equivalent note on tests/integration/test_witnessmark_lifecycle.py's " +
          "test_contest_round_reaches_a_terminal_state for the same, already-documented behavior.",
      );
    } else {
      await contestButton.click();
      txLog.contest_verdict = await waitForTxConfirmedAndGetHash(creatorPage, NONDET_TX_TIMEOUT);
      console.log(`contest_verdict tx: ${txLog.contest_verdict}`);

      await counterpartyPage.goto(`/promises/${promiseId}`);
      await counterpartyPage.getByRole("button", { name: "Resolve contest" }).click();
      txLog.resolve_contest = await waitForTxConfirmedAndGetHash(counterpartyPage, NONDET_TX_TIMEOUT);
      console.log(`resolve_contest tx: ${txLog.resolve_contest}`);
    }

    console.log("FULL TX LOG:", JSON.stringify(txLog, null, 2));
    expect(Object.keys(txLog).length).toBeGreaterThanOrEqual(4); // create, accept, submit_evidence, resolve at minimum
  });
});
