import { Router } from "express";
import multer from "multer";
import { uploadEvidenceFile } from "../lib/cloudinary.js";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { normalizeAddress } from "../lib/auth.js";
import { genlayerReads } from "../lib/genlayer.js";
import { cached } from "../lib/redis.js";

export const evidenceRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 6 },
});

/**
 * Uploads one or more evidence files and returns their public URLs. The
 * frontend then includes these URLs (alongside any raw evidence URLs the
 * user typed directly) in the JSON array it passes to the contract's
 * submit_evidence(evidence_urls_json, ...) -- this endpoint never talks to
 * the contract itself, it only gets bytes onto a stable public URL.
 *
 * AUTHORIZATION: only the promise's on-chain COUNTERPARTY may upload
 * evidence for it -- verified against a live get_promise() read, not
 * merely "any authenticated wallet". Earlier versions of this endpoint
 * only required a valid session (any signed-in wallet), which let any
 * authenticated address upload arbitrary files under any promiseId. That
 * could never move funds (submit_evidence itself independently re-checks
 * the caller is the counterparty on-chain, and the contract only ever
 * fetches URLs a counterparty actually submits), but it did allow storage
 * abuse and misleading evidence_files metadata -- closed here rather than
 * left as a known gap. The promise lookup is cached (matches the TTL
 * `promises.ts` uses for the same read) so a batch of files for the same
 * promise doesn't multiply StudioNet reads per file.
 */
evidenceRouter.post("/upload", requireAuth, upload.array("files", 6), async (req: AuthedRequest, res) => {
  const promiseId = Number(req.body.promiseId);
  if (!Number.isInteger(promiseId) || promiseId < 0) {
    return res.status(400).json({ error: "valid promiseId is required" });
  }
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "no files provided" });
  }

  const uploader = normalizeAddress(req.address!);

  let chainPromise;
  try {
    chainPromise = await cached(`promise:${promiseId}`, 20, () => genlayerReads.getPromise(promiseId));
  } catch (err) {
    return res.status(404).json({ error: "promise not found or unreachable", detail: (err as Error).message });
  }
  if (normalizeAddress(chainPromise.counterparty) !== uploader) {
    return res.status(403).json({ error: "only the promise's counterparty may upload evidence for it" });
  }
  const uploadableStatuses = new Set(["ACCEPTED", "EVIDENCE_SUBMITTED", "UNDETERMINED"]);
  if (!uploadableStatuses.has(chainPromise.status)) {
    return res.status(409).json({ error: `promise is not awaiting evidence (status: ${chainPromise.status})` });
  }

  const results = [];
  for (const file of files) {
    try {
      const uploaded = await uploadEvidenceFile(file.buffer, file.originalname, promiseId);
      await pool.query(
        `INSERT INTO evidence_files (promise_id, uploaded_by, cloudinary_public_id, url, resource_type, bytes, original_filename)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [promiseId, uploader, uploaded.publicId, uploaded.url, uploaded.resourceType, uploaded.bytes, uploaded.originalFilename],
      );
      results.push({ url: uploaded.url, filename: uploaded.originalFilename, bytes: uploaded.bytes });
    } catch (err) {
      results.push({ error: (err as Error).message, filename: file.originalname });
    }
  }

  const anySucceeded = results.some((r) => "url" in r);
  res.status(anySucceeded ? 200 : 502).json({ files: results });
});

evidenceRouter.get("/:promiseId", async (req, res) => {
  const promiseId = Number(req.params.promiseId);
  if (!Number.isInteger(promiseId) || promiseId < 0) {
    return res.status(400).json({ error: "invalid promise id" });
  }
  const { rows } = await pool.query(
    `SELECT url, resource_type, bytes, original_filename, uploaded_by, created_at
     FROM evidence_files WHERE promise_id = $1 ORDER BY created_at ASC`,
    [promiseId],
  );
  res.json(rows);
});
