import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { del as delLegacyBlob } from '@vercel/blob';

// Audio and cover files live in a Cloudflare R2 bucket (S3-compatible API).
// Environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
// R2_PUBLIC_URL is the public base of the bucket (r2.dev or a custom domain), e.g. https://files.example.com
const UPLOAD_TTL_SEC = 180;

let client = null;
function s3() {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function r2Configured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID
    && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);
}

function publicBase() {
  return String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
}

// public address for a stored key
export function publicUrlFor(key) {
  return `${publicBase()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

// a short-lived PUT address the browser can upload to directly
export async function presignUpload(key, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: UPLOAD_TTL_SEC });
}

// true for links we stored: our R2 public base, or the legacy Vercel Blob store
export function isOurFileUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (publicBase() && url.startsWith(publicBase() + '/')) return true;
    return u.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch { return false; }
}

// remove stored files; R2 keys are deleted in R2, older Blob links through the Blob API
export async function deleteFiles(urls) {
  const r2Keys = [];
  const legacy = [];
  for (const url of urls.filter(Boolean)) {
    if (publicBase() && url.startsWith(publicBase() + '/')) {
      r2Keys.push(decodeURIComponent(url.slice(publicBase().length + 1)));
    } else {
      legacy.push(url);
    }
  }
  if (r2Keys.length) {
    await s3().send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET,
      Delete: { Objects: r2Keys.map((Key) => ({ Key })), Quiet: true },
    }));
  }
  if (legacy.length && process.env.BLOB_READ_WRITE_TOKEN) {
    await delLegacyBlob(legacy);
  }
}
