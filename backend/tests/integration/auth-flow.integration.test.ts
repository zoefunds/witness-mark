import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// GenLayer reads are mocked here deliberately -- this suite's whole point
// is exercising the REAL Postgres (auth_nonces/users tables, actual SQL)
// and the REAL session-cookie flow end-to-end, not the chain. Hitting
// live StudioNet from every CI run would also burn its 30 req/min budget
// for no additional signal these tests are designed to give.
vi.mock("../../src/lib/genlayer.js", () => ({
  genlayerReads: {},
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

let app: import("express").Express;
let SESSION_COOKIE_NAME: string;

beforeAll(async () => {
  ({ app } = await import("../../src/app.js"));
  ({ SESSION_COOKIE_NAME } = await import("../../src/lib/auth.js"));
});

describe("wallet-auth flow against a real database (no mocks below the route layer)", () => {
  it("issues a nonce, persists it in a real auth_nonces row, and a real signature completes sign-in", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const address = account.address;

    const nonceRes = await request(app).post("/api/auth/nonce").send({ address });
    expect(nonceRes.status).toBe(200);
    // The server normalizes to lowercase (see normalizeAddress) before
    // embedding the address in the sign-in message.
    expect(nonceRes.body.message).toContain(address.toLowerCase());

    // A REAL signature over the REAL message the server just persisted --
    // not a stubbed/mocked signer.
    const signature = await account.signMessage({ message: nonceRes.body.message });

    const verifyRes = await request(app).post("/api/auth/verify").send({ address, signature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.address).toBe(address.toLowerCase());

    const cookieHeader = verifyRes.headers["set-cookie"]?.[0];
    expect(cookieHeader).toBeTruthy();
    const cookieValue = cookieHeader!.split(";")[0];
    expect(cookieValue.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);

    const sessionRes = await request(app).get("/api/auth/session").set("Cookie", cookieValue);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.address).toBe(address.toLowerCase());
    // Confirms the users table actually got a real UPSERT, not just an
    // in-memory session -- a second, independent read of the same row
    // via the same route proves persistence, not a lucky cache hit.
    expect(sessionRes.body.user.address).toBe(address.toLowerCase());
  });

  it("rejects a signature from a DIFFERENT wallet than the one that requested the nonce", async () => {
    const requester = privateKeyToAccount(generatePrivateKey());
    const impostor = privateKeyToAccount(generatePrivateKey());

    const nonceRes = await request(app).post("/api/auth/nonce").send({ address: requester.address });
    const wrongSignature = await impostor.signMessage({ message: nonceRes.body.message });

    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: requester.address, signature: wrongSignature });
    expect(verifyRes.status).toBe(401);
  });

  it("a nonce is single-use: replaying the same signature after sign-in fails (nonce already consumed in the real DB)", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonceRes = await request(app).post("/api/auth/nonce").send({ address: account.address });
    const signature = await account.signMessage({ message: nonceRes.body.message });

    const first = await request(app).post("/api/auth/verify").send({ address: account.address, signature });
    expect(first.status).toBe(200);

    const replay = await request(app).post("/api/auth/verify").send({ address: account.address, signature });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toMatch(/no pending nonce/);
  });

  it("requesting a second nonce for the same address invalidates the first (real ON CONFLICT upsert)", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const first = await request(app).post("/api/auth/nonce").send({ address: account.address });
    const second = await request(app).post("/api/auth/nonce").send({ address: account.address });
    expect(first.body.message).not.toBe(second.body.message);

    // Signing the STALE first message must fail now that the DB row has
    // been overwritten with the second nonce.
    const staleSignature = await account.signMessage({ message: first.body.message });
    const verifyRes = await request(app)
      .post("/api/auth/verify")
      .send({ address: account.address, signature: staleSignature });
    expect(verifyRes.status).toBe(401);
  });
});
