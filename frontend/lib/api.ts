import { env } from "./env";

// Typed wrapper around the WitnessMark backend REST API.
//
// Verified against the deployed backend (witnessmark-api on Fly.io,
// see /Users/macbook/witnessmark/backend/src/routes/*.ts) as of the
// integration pass that reconciled this file with the real endpoint
// shapes:
//   POST /api/auth/nonce          { address } -> { message, expiresAt }
//   POST /api/auth/verify         { address, signature } -> { address }  (sets httpOnly cookie)
//   POST /api/auth/logout         -> { ok }
//   GET  /api/auth/session        -> { address, user } | 401
//   GET  /api/promises?role=&status=&address= -> Array<PromiseIndexRow>  (bare array)
//   GET  /api/promises/:id        -> the raw get_promise() view result
//   POST /api/evidence/upload     multipart, field "files" (up to 6) + field "promiseId"
//                                  -> { files: Array<{ url, filename, bytes } | { error, filename }> }
//   GET  /api/reputation/:address -> the raw get_reputation() view result
// All calls degrade gracefully (throw a typed ApiError) if the backend is
// unreachable or NEXT_PUBLIC_API_URL is unset, since the contract is
// always the source of truth and the backend is a cache/aux layer only.

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function baseUrl(): string {
  if (!env.apiUrl) throw new ApiError("Backend API URL is not configured (NEXT_PUBLIC_API_URL).");
  return env.apiUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Could not reach the WitnessMark backend. It may be offline.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface PromiseIndexRow {
  promise_id: number;
  creator_address: string;
  counterparty_address: string;
  title: string;
  category: string;
  last_known_status: string;
  stake_wei: string;
  created_ts: number;
}

export type EvidenceUploadResult = { url: string; filename: string; bytes: number } | { error: string; filename: string };

export const api = {
  auth: {
    nonce: (address: string) =>
      request<{ message: string; expiresAt: string }>("/api/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ address }),
      }),
    verify: (address: string, signature: string) =>
      request<{ address: string }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ address, signature }),
      }),
    logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
    session: () => request<{ address: string; user: unknown }>("/api/auth/session"),
  },
  promises: {
    list: (params: { role?: "creator" | "counterparty"; status?: string; address?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.role) qs.set("role", params.role);
      if (params.status) qs.set("status", params.status);
      if (params.address) qs.set("address", params.address);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<PromiseIndexRow[]>(`/api/promises${suffix}`);
    },
    get: (id: number) => request<unknown>(`/api/promises/${id}`),
    sync: (
      id: number,
      body: {
        creator: string;
        counterparty: string;
        title: string;
        category: string;
        status: string;
        stakeWei: string;
        createdTs: number;
      },
    ) => request<{ ok: boolean }>(`/api/promises/${id}/sync`, { method: "POST", body: JSON.stringify(body) }),
  },
  evidence: {
    // Uploads one or more files for a given promise. `promiseId` is
    // required by the backend (files are namespaced under
    // witnessmark/evidence/{promiseId} in Cloudinary storage). Returns one
    // result per file, in order -- a failed individual file shows up as
    // `{ error, filename }` rather than aborting the whole batch.
    upload: async (files: File[], promiseId: number): Promise<EvidenceUploadResult[]> => {
      const form = new FormData();
      form.append("promiseId", String(promiseId));
      for (const file of files) form.append("files", file);
      const res = await request<{ files: EvidenceUploadResult[] }>("/api/evidence/upload", {
        method: "POST",
        body: form,
      });
      return res.files;
    },
  },
  reputation: {
    get: (address: string) => request<unknown>(`/api/reputation/${address}`),
  },
};
