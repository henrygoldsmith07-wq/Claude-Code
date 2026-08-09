import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { required, optional } from "./env";

/**
 * Cloudflare R2 is S3-compatible. The endpoint is derived from the account id.
 * Recordings are stored privately; the browser/desktop app uploads via a
 * short-lived presigned PUT, and playback uses a short-lived presigned GET
 * (unless R2_PUBLIC_BASE_URL is set for a public bucket/custom domain).
 */
let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const accountId = required("R2_ACCOUNT_ID");
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cached;
}

function bucket(): string {
  return required("R2_BUCKET");
}

/** Presigned URL the recorder uses to PUT the file straight into R2. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresInSec = 60 * 60
): Promise<{ url: string; headers: Record<string, string> }> {
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: expiresInSec }
  );
  return { url, headers: { "Content-Type": contentType } };
}

/** URL used by the <video> element to stream a recording back. */
export async function playbackUrl(key: string, expiresInSec = 60 * 60): Promise<string> {
  const publicBase = optional("R2_PUBLIC_BASE_URL");
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: expiresInSec,
  });
}

/** Fetch the raw object bytes (used server-side to forward audio to Groq). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const body = res.Body as unknown as { transformToByteArray: () => Promise<Uint8Array> };
  return body.transformToByteArray();
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
