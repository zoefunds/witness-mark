"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { api, ApiError } from "@/lib/api";

/**
 * Wallet-auth session: connect -> nonce -> signature -> backend-verified
 * session, per WITNESSMARK.md section 15. Wallet *connection* alone
 * (handled by useWallet/Reown AppKit) is never treated as authentication
 * -- every session here required the connected wallet to actually sign a
 * fresh, backend-issued, single-use nonce.
 *
 * This session is independent of contract writes: every fund-moving
 * action (create_promise, submit_evidence, etc.) is authorized by its own
 * wallet-signed transaction regardless of this session's state. This hook
 * only gates backend-side, per-user actions that need server-side
 * attribution -- currently just evidence file uploads, since Cloudinary
 * credentials must never be reachable without some form of caller
 * identity check.
 */
export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  // Tracks which address the last completed session check was FOR, rather
  // than a plain boolean reset synchronously inside the effect body (an
  // anti-pattern react-hooks/set-state-in-effect flags, since it causes an
  // extra render before the real async result lands). `checked` below is
  // derived from comparing this to the current `address` -- no direct
  // setState call happens in the effect body itself, only inside the
  // promise's own .then/.catch/.finally callbacks.
  const [checkedForAddress, setCheckedForAddress] = useState<string | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount (and whenever the connected address changes), check whether
  // a valid session cookie already covers this address.
  useEffect(() => {
    let cancelled = false;
    api.auth
      .session()
      .then((res) => {
        if (!cancelled) setSessionAddress(res.address.toLowerCase());
      })
      .catch(() => {
        if (!cancelled) setSessionAddress(null);
      })
      .finally(() => {
        if (!cancelled) setCheckedForAddress(address ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const checked = checkedForAddress === (address ?? null);

  const isAuthenticated = Boolean(
    isConnected && address && sessionAddress && sessionAddress === address.toLowerCase(),
  );

  const signIn = useCallback(async () => {
    if (!address) throw new ApiError("Connect a wallet first.");
    setSigningIn(true);
    setError(null);
    try {
      const { message } = await api.auth.nonce(address);
      const signature = await signMessageAsync({ message });
      const result = await api.auth.verify(address, signature);
      setSessionAddress(result.address.toLowerCase());
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sign-in was cancelled or failed.";
      setError(message);
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* best-effort */
    }
    setSessionAddress(null);
  }, []);

  return { isAuthenticated, checked, signingIn, error, signIn, signOut };
}
