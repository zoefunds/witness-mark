import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import pg from "pg";

const getPromiseMock = vi.fn();
const uploadEvidenceFileMock = vi.fn();

vi.mock("../../src/lib/genlayer.js", () => ({
  genlayerReads: { getPromise: (...args: unknown[]) => getPromiseMock(...args) },
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));
// Cloudinary itself stays mocked -- an external paid service test
// credentials shouldn't upload real files to on every CI run -- but
// everything AROUND it (auth, authorization, the real evidence_files
// insert) is real.
vi.mock("../../src/lib/cloudinary.js", () => ({
  uploadEvidenceFile: (...args: unknown[]) => uploadEvidenceFileMock(...args),
}));

let app: import("express").Express;
let SESSION_COOKIE_NAME: string;
let pool: pg.Pool;

const COUNTERPARTY = "0x4444444444444444444444444444444444444e";

function sessionCookieFor(address: string) {
  const token = jwt.sign({ address }, process.env.SESSION_JWT_SECRET!, { expiresIn: 3600 });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

beforeAll(async () => {
  ({ app } = await import("../../src/app.js"));
  ({ SESSION_COOKIE_NAME } = await import("../../src/lib/auth.js"));
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
});

beforeEach(() => {
  getPromiseMock.mockClear();
  uploadEvidenceFileMock.mockClear();
});

describe("POST /api/evidence/upload against a real evidence_files table", () => {
  it("an authorized counterparty upload inserts a real, queryable row", async () => {
    getPromiseMock.mockResolvedValueOnce({ counterparty: COUNTERPARTY, status: "ACCEPTED" });
    uploadEvidenceFileMock.mockResolvedValueOnce({
      publicId: "witnessmark/evidence/501/real-test-file",
      url: "https://res.cloudinary.com/test-cloud/image/upload/real-test-file.png",
      resourceType: "image",
      bytes: 5,
      originalFilename: "proof.png",
    });

    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "501")
      .attach("files", Buffer.from("hello"), "proof.png");

    expect(res.status).toBe(200);
    expect(res.body.files[0].url).toContain("real-test-file.png");

    const { rows } = await pool.query("SELECT * FROM evidence_files WHERE promise_id = $1", [501]);
    expect(rows).toHaveLength(1);
    expect(rows[0].uploaded_by).toBe(COUNTERPARTY.toLowerCase());
    expect(rows[0].url).toContain("real-test-file.png");
  });

  it("GET /api/evidence/:promiseId reads the real row back", async () => {
    getPromiseMock.mockResolvedValueOnce({ counterparty: COUNTERPARTY, status: "ACCEPTED" });
    uploadEvidenceFileMock.mockResolvedValueOnce({
      publicId: "witnessmark/evidence/502/x",
      url: "https://res.cloudinary.com/test-cloud/image/upload/x.png",
      resourceType: "image",
      bytes: 5,
      originalFilename: "x.png",
    });
    await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "502")
      .attach("files", Buffer.from("hello"), "x.png");

    const res = await request(app).get("/api/evidence/502");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].original_filename).toBe("x.png");
  });

  it("rejects a non-counterparty wallet (403) and writes NO row to the real table", async () => {
    const stranger = "0x5555555555555555555555555555555555555e";
    getPromiseMock.mockResolvedValueOnce({ counterparty: COUNTERPARTY, status: "ACCEPTED" });

    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(stranger))
      .field("promiseId", "503")
      .attach("files", Buffer.from("hello"), "x.png");

    expect(res.status).toBe(403);
    expect(uploadEvidenceFileMock).not.toHaveBeenCalled();
    const { rows } = await pool.query("SELECT * FROM evidence_files WHERE promise_id = $1", [503]);
    expect(rows).toHaveLength(0);
  });

  it("a Cloudinary failure for one file in a batch does not roll back the other's real DB row", async () => {
    getPromiseMock.mockResolvedValueOnce({ counterparty: COUNTERPARTY, status: "ACCEPTED" });
    uploadEvidenceFileMock
      .mockRejectedValueOnce(new Error("simulated Cloudinary outage"))
      .mockResolvedValueOnce({
        publicId: "witnessmark/evidence/504/ok",
        url: "https://res.cloudinary.com/test-cloud/image/upload/ok.png",
        resourceType: "image",
        bytes: 5,
        originalFilename: "ok.png",
      });

    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "504")
      .attach("files", Buffer.from("fail"), "fail.png")
      .attach("files", Buffer.from("ok"), "ok.png");

    expect(res.status).toBe(200); // at least one file succeeded
    expect(res.body.files.some((f: { error?: string }) => f.error)).toBe(true);
    expect(res.body.files.some((f: { url?: string }) => f.url?.includes("ok.png"))).toBe(true);

    const { rows } = await pool.query("SELECT * FROM evidence_files WHERE promise_id = $1", [504]);
    expect(rows).toHaveLength(1);
    expect(rows[0].original_filename).toBe("ok.png");
  });
});
