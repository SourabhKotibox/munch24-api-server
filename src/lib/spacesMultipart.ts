import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import axios from 'axios';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  ListMultipartUploadsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import {
  getActiveStorageSettings,
  getCloudStorageClient,
  getPublicUrl,
  normalizeObjectKey,
  type S3Settings,
} from './s3';

const DEFAULT_PART_SIZE_MB = 16;
const DEFAULT_ABANDONED_HOURS = 24;
const DEFAULT_DIRECT_THRESHOLD_MB = 8;

export const getUploadPartSizeBytes = (): number => {
  const mb = Number(process.env.UPLOAD_PART_SIZE_MB || DEFAULT_PART_SIZE_MB);
  const bytes = Math.round((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_PART_SIZE_MB) * 1024 * 1024);
  return Math.max(5 * 1024 * 1024, bytes);
};

export const getDirectUploadThresholdBytes = (): number => {
  const mb = Number(process.env.DIRECT_UPLOAD_THRESHOLD_MB || DEFAULT_DIRECT_THRESHOLD_MB);
  return Math.round((Number.isFinite(mb) && mb >= 0 ? mb : DEFAULT_DIRECT_THRESHOLD_MB) * 1024 * 1024);
};

export const getAbandonedUploadHours = (): number => {
  const hours = Number(process.env.MULTIPART_ABANDONED_HOURS || DEFAULT_ABANDONED_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ABANDONED_HOURS;
};

export const supportsBrowserDirectUpload = (driver: S3Settings['storageDriver']): boolean =>
  driver === 's3' || driver === 'digitalocean';

export function extractObjectKey(urlOrKey: string, settings?: S3Settings): string {
  if (!urlOrKey) return '';
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    return normalizeObjectKey(urlOrKey, settings?.bucket);
  }

  try {
    const parsed = new URL(urlOrKey);
    let pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    if (settings?.bucket && pathname.startsWith(`${settings.bucket}/`)) {
      pathname = pathname.slice(settings.bucket.length + 1);
    }
    return normalizeObjectKey(pathname, settings?.bucket);
  } catch {
    return normalizeObjectKey(urlOrKey, settings?.bucket);
  }
}

export async function createMultipartUpload(key: string, contentType: string) {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  const result = await client.send(new CreateMultipartUploadCommand({
    Bucket: settings.bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  }));

  if (!result.UploadId) {
    throw new Error('DigitalOcean/S3 did not return a multipart upload ID');
  }

  return {
    uploadId: result.UploadId,
    key,
    bucket: settings.bucket,
  };
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  const command = new UploadPartCommand({
    Bucket: settings.bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
) {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: settings.bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sorted.map((part) => ({
        PartNumber: part.PartNumber,
        ETag: part.ETag.startsWith('"') ? part.ETag : `"${part.ETag.replace(/"/g, '')}"`,
      })),
    },
  }));
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  await client.send(new AbortMultipartUploadCommand({
    Bucket: settings.bucket,
    Key: key,
    UploadId: uploadId,
  }));
}

export async function listUploadedParts(key: string, uploadId: string) {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  const parts: Array<{ partNumber: number; etag: string; size: number }> = [];
  let partNumberMarker: string | undefined;

  do {
    const result = await client.send(new ListPartsCommand({
      Bucket: settings.bucket,
      Key: key,
      UploadId: uploadId,
      ...(partNumberMarker ? { PartNumberMarker: partNumberMarker } : {}),
    }));
    for (const part of result.Parts || []) {
      if (!part.PartNumber || !part.ETag) continue;
      parts.push({
        partNumber: part.PartNumber,
        etag: part.ETag,
        size: part.Size || 0,
      });
    }
    partNumberMarker = result.IsTruncated && result.NextPartNumberMarker
      ? String(result.NextPartNumberMarker)
      : undefined;
  } while (partNumberMarker);

  return parts;
}

export async function headCloudObject(key: string): Promise<{
  exists: boolean;
  contentType?: string;
  contentLength?: number;
}> {
  const settings = await getActiveStorageSettings();
  const client = await getCloudStorageClient();
  try {
    const result = await client.send(new HeadObjectCommand({
      Bucket: settings.bucket,
      Key: normalizeObjectKey(key, settings.bucket),
    }));
    return {
      exists: true,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      return { exists: false };
    }
    throw error;
  }
}

export async function downloadCloudObjectToFile(keyOrUrl: string, destPath: string): Promise<string> {
  const settings = await getActiveStorageSettings();
  const key = extractObjectKey(keyOrUrl, settings);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (settings.storageDriver === 'bunny') {
    const publicUrl = getPublicUrl(settings, key);
    const response = await axios.get(publicUrl, { responseType: 'stream', maxContentLength: Infinity });
    await pipeline(response.data, fs.createWriteStream(destPath));
    return destPath;
  }

  const client = await getCloudStorageClient();
  const result = await client.send(new GetObjectCommand({
    Bucket: settings.bucket,
    Key: key,
  }));

  if (!result.Body) {
    throw new Error(`Cloud object has no body: ${key}`);
  }

  const body = result.Body as Readable;
  await pipeline(body, fs.createWriteStream(destPath));
  return destPath;
}

export async function ensureBrowserUploadCors(allowedOrigins: string[] = ['*']): Promise<{
  applied: boolean;
  message: string;
}> {
  const settings = await getActiveStorageSettings();
  if (!supportsBrowserDirectUpload(settings.storageDriver)) {
    return { applied: false, message: 'CORS apply is only supported for DigitalOcean Spaces and S3' };
  }

  const client = await getCloudStorageClient();
  const desiredOrigins = allowedOrigins.length > 0 ? allowedOrigins : ['*'];

  try {
    const existing = await client.send(new GetBucketCorsCommand({ Bucket: settings.bucket }));
    const hasPut = (existing.CORSRules || []).some((rule) =>
      (rule.AllowedMethods || []).includes('PUT') &&
      (rule.AllowedOrigins || []).some((origin) => origin === '*' || desiredOrigins.includes(origin))
    );
    if (hasPut) {
      return { applied: false, message: 'Bucket CORS already allows browser uploads' };
    }
  } catch (error: any) {
    if (error?.name !== 'NoSuchCORSConfiguration' && error?.$metadata?.httpStatusCode !== 404) {
      logger.warn({ error }, 'Could not read existing bucket CORS');
    }
  }

  await client.send(new PutBucketCorsCommand({
    Bucket: settings.bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: desiredOrigins,
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-version-id'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }));

  logger.info({ bucket: settings.bucket, driver: settings.storageDriver }, 'Applied browser upload CORS to storage bucket');
  return { applied: true, message: 'Bucket CORS updated for browser direct uploads' };
}

export async function abortAbandonedMultipartUploads(maxAgeHours = getAbandonedUploadHours()): Promise<number> {
  const settings = await getActiveStorageSettings();
  if (!supportsBrowserDirectUpload(settings.storageDriver) || !settings.bucket) {
    return 0;
  }

  const client = await getCloudStorageClient();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  let aborted = 0;
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;

  do {
    const listed = await client.send(new ListMultipartUploadsCommand({
      Bucket: settings.bucket,
      KeyMarker: keyMarker,
      UploadIdMarker: uploadIdMarker,
    }));

    for (const upload of listed.Uploads || []) {
      const initiated = upload.Initiated?.getTime() || 0;
      if (!upload.Key || !upload.UploadId || !initiated || initiated >= cutoff) continue;
      try {
        await client.send(new AbortMultipartUploadCommand({
          Bucket: settings.bucket,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }));
        aborted += 1;
        logger.info({
          event: 'ABANDONED_UPLOAD_CLEANED',
          storageKey: upload.Key,
          uploadId: upload.UploadId,
        }, 'Aborted abandoned multipart upload');
      } catch (error) {
        logger.warn({ error, key: upload.Key }, 'Failed to abort abandoned multipart upload');
      }
    }

    keyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
    uploadIdMarker = listed.IsTruncated ? listed.NextUploadIdMarker : undefined;
  } while (keyMarker);

  return aborted;
}
