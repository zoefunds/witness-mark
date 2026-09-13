"use client";

import { useEffect } from "react";
import { connect } from "wagmi/actions";
import { injected } from "wagmi/connectors";
import { wagmiAdapter } from "@/lib/wagmi-config";

/**
 * Exposes a single function, window.__e2eConnectInjected, that calls
 * wagmi's own connect() action against the injected() connector directly
 * -- bypassing Reown AppKit's connector-picker modal UI entirely.
 *
 * Why this exists: e2e/signed-lifecycle.spec.ts injects a real
 * EIP-1193/EIP-6963 test wallet (a genuine viem local account capable of
 * signing/sending for real against StudioNet), but AppKit's modal does
 * not currently surface an injected/announced wallet as a selectable
 * option in its UI (confirmed by screenshot -- see docs/testing.md's
 * "Signed E2E" section). Rather than keep debugging AppKit's internal
 * wallet-detection/rendering logic, this calls the exact same underlying
 * wagmi action AppKit's own "Connect" button would eventually call, just
 * without going through its UI layer -- a legitimate, narrower
 * integration point for test automation, not a way to skip real wallet
 * signing (a real injected provider must still exist and answer
 * personal_sign/eth_sendTransaction for anything to actually work).
 *
 * This is intentionally NOT gated behind an env var: it exposes no
 * secret, cannot move funds or sign anything by itself (it only
 * *requests* a connection from whatever's at window.ethereum, exactly
 * like every "Connect Wallet" button on every dApp already does), and
 * gating it behind a build-time flag would mean either shipping a
 * separate test build or never actually exercising this against the
 * real production deployment E2E is supposed to test.
 */
export function E2EWalletHook() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __e2eConnectInjected?: () => Promise<string | undefined> }).__e2eConnectInjected =
      async () => {
        const result = await connect(wagmiAdapter.wagmiConfig, { connector: injected() });
        return result.accounts[0];
      };
  }, []);

  return null;
}
