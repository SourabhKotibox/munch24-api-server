import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import { SettingsModel } from '../models/Settings';

// Helper function to get settings from database
export async function getS3Settings() {
  const settings = await SettingsModel.findOne();
  return {
    accessKeyId: settings?.awsAccessKeyId || process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: settings?.awsSecretAccessKey || process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    region: settings?.awsRegion || process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1',
    bucket: settings?.awsBucket || process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'tripleminds-ott-admin',
    pathStyle: settings?.awsPathStyleEndpoint || false,
    storageDriver: settings?.storageDriver || 'local'
  };
}

// Create S3 client dynamically based on settings
export async function getS3Client() {
  const settings = await getS3Settings();
  return new S3Client({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    ...(settings.pathStyle && {
      forcePathStyle: true
    })
  });
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<PresignedUrlResult> {
  const settings = await getS3Settings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 's3') {
    logger.warn('AWS S3 credentials not found or S3 not selected, returning mock URL');
    return {
      uploadUrl: `https://mock-storage.local/upload/${key}?token=dev-placeholder`,
      publicUrl: `https://mock-storage.local/${key}`,
      key,
    };
  }

  try {
    const s3Client = await getS3Client();
    const command = new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const publicUrl = settings.pathStyle 
      ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}/${key}`
      : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      publicUrl,
      key,
    };
  } catch (error) {
    logger.error(error, 'Error generating presigned URL');
    throw error;
  }
}

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | string | ReadableStream | Blob,
  contentType: string
): Promise<string> {
  const settings = await getS3Settings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 's3') {
    logger.warn('AWS S3 credentials not found or S3 not selected, skipping upload to S3');
    throw new Error('AWS S3 credentials not configured');
  }

  try {
    const s3Client = await getS3Client();
    const command = new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    const publicUrl = settings.pathStyle 
      ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}/${key}`
      : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${key}`;
    return publicUrl;
  } catch (error) {
    logger.error(error, 'Error uploading to S3');
    throw error;
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  const settings = await getS3Settings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 's3') {
    logger.warn('AWS S3 credentials not found or S3 not selected, skipping delete from S3');
    return;
  }

  try {
    const s3Client = await getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: settings.bucket,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    logger.error(error, 'Error deleting from S3');
    throw error;
  }
}

export async function isS3Configured(): Promise<boolean> {
  const settings = await getS3Settings();
  return !!(settings.accessKeyId && settings.secretAccessKey && settings.storageDriver === 's3');
}

export async function getS3PublicUrl(key: string): Promise<string> {
  const settings = await getS3Settings();
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  
  // Normalize key by stripping leading slash or uploads/ prefix if present
  let cleanKey = key;
  if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
  if (cleanKey.startsWith('uploads/')) cleanKey = cleanKey.replace('uploads/', '');
  if (cleanKey.startsWith('/uploads/')) cleanKey = cleanKey.replace('/uploads/', '');

  return settings.pathStyle 
    ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}/${cleanKey}`
    : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${cleanKey}`;
}

/**
 * Returns the base public URL for the S3 bucket (no trailing slash).
 * Used to prefix HLS master.m3u8 and individual playlist URLs.
 */
export async function getHlsPublicBaseUrl(): Promise<string> {
  const settings = await getS3Settings();
  const base = settings.pathStyle
    ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}`
    : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com`;
  return base;
}

/**
 * Recursively uploads an entire local HLS output folder to S3.
 * Preserves the relative directory structure under the given S3 prefix.
 *
 * @param localFolderPath   Absolute path to the local HLS output folder.
 * @param s3Prefix          S3 key prefix, e.g. "hls/movies/abc123".
 * @returns                 Number of files uploaded.
 */
export async function uploadHlsFolderToS3(localFolderPath: string, s3Prefix: string): Promise<number> {
  const settings = await getS3Settings();
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 's3') {
    throw new Error('S3 is not configured — cannot upload HLS folder');
  }

  const s3Client = await getS3Client();
  let uploadCount = 0;

  const getContentType = (filePath: string): string => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.m3u8') return 'application/x-mpegURL';
    if (ext === '.ts')   return 'video/MP2T';
    return 'application/octet-stream';
  };

  const uploadDir = async (dirPath: string, keyPrefix: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const s3Key   = `${keyPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await uploadDir(fullPath, s3Key);
      } else if (entry.isFile()) {
        const body        = fs.readFileSync(fullPath);
        const contentType = getContentType(entry.name);
        const ext         = path.extname(entry.name).toLowerCase();
        await s3Client.send(
          new PutObjectCommand({
            Bucket:      settings.bucket,
            Key:         s3Key,
            Body:        body,
            ContentType: contentType,
            // Ensure .m3u8 files are not cached aggressively by CDN/browser
            CacheControl: ext === '.m3u8' ? 'no-cache' : 'max-age=31536000',
          })
        );
        uploadCount++;
        logger.debug(`Uploaded HLS file to S3: ${s3Key}`);
      }
    });
    await Promise.all(promises);
  };

  await uploadDir(localFolderPath, s3Prefix);
  logger.info({ s3Prefix, uploadCount }, 'HLS folder uploaded to S3');
  return uploadCount;
}
