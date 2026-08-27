import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadedEvidenceFile {
  publicId: string;
  url: string;
  resourceType: "image" | "raw" | "video";
  bytes: number;
  originalFilename: string;
}

const MAX_EVIDENCE_FILE_BYTES = 15 * 1024 * 1024; // 15MB, matches the frontend's stated upload limit

/**
 * Uploads a single evidence file to Cloudinary and returns a STABLE,
 * PUBLIC URL. That URL -- and nothing else about the file -- is what
 * eventually gets passed into the contract's submit_evidence(); the
 * contract fetches the URL itself and never trusts file bytes from
 * calldata, so this function's only job is "get the bytes to a URL the
 * contract can reach".
 */
export async function uploadEvidenceFile(
  buffer: Buffer,
  originalFilename: string,
  promiseId: number,
): Promise<UploadedEvidenceFile> {
  if (buffer.length === 0) {
    throw new Error("empty file");
  }
  if (buffer.length > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error(`file exceeds ${MAX_EVIDENCE_FILE_BYTES} byte limit`);
  }

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `witnessmark/evidence/${promiseId}`,
        resource_type: "auto",
        // Evidence must never be silently altered -- no transformation,
        // no compression, no format conversion applied on upload.
        overwrite: false,
        unique_filename: true,
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else resolve(uploadResult);
      },
    );
    stream.end(buffer);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
    resourceType: result.resource_type,
    bytes: result.bytes,
    originalFilename,
  };
}
