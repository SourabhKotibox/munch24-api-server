import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import { SettingsModel } from '../models/Settings';

type UploadBody = Buffer | Uint8Array | string | ReadableStream | Blob | Readable | fs.ReadStream;

export interface S3Settings {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  pathStyle: boolean;
  storageDriver: 'local' | 's3' | 'digitalocean' | 'bunny';
  endpoint?: string;
  cdnUrl?: string;
}

export async function getS3Settings(): Promise<S3Settings> {
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

export async function getDOSettings(): Promise<S3Settings> {
  const settings = await SettingsModel.findOne();
  const region = settings?.doRegion || process.env.DO_REGION || 'nyc3';
  return {
    accessKeyId: settings?.doAccessKey || process.env.DO_ACCESS_KEY || '',
    secretAccessKey: settings?.doSecretKey || process.env.DO_SECRET_KEY || '',
    region,
    bucket: settings?.doBucket || process.env.DO_BUCKET || '',
    pathStyle: settings?.doPathStyle ?? true,
    storageDriver: settings?.storageDriver || 'local',
    endpoint: `https://${region}.digitaloceanspaces.com`,
    cdnUrl: settings?.doCdnUrl || process.env.DO_CDN_URL || ''
  };
}

export async function getBunnySettings(): Promise<S3Settings> {
  const settings = await SettingsModel.findOne();
  const storageZone = settings?.bunnyStorageZone || process.env.BUNNY_STORAGE_ZONE || '';
  const cdnUrl = settings?.bunnyCdnUrl || process.env.BUNNY_CDN_URL || (storageZone ? `https://${storageZone}.b-cdn.net` : '');

  return {
    // Bunny Storage calls this value an access key. It fills both credential fields
    // so the shared cloud-storage readiness checks remain provider-agnostic.
    accessKeyId: settings?.bunnyAccessKey || process.env.BUNNY_STORAGE_ACCESS_KEY || '',
    secretAccessKey: settings?.bunnyAccessKey || process.env.BUNNY_STORAGE_ACCESS_KEY || '',
    region: process.env.BUNNY_STORAGE_REGION || '',
    bucket: storageZone,
    pathStyle: false,
    storageDriver: settings?.storageDriver || 'local',
    endpoint: (process.env.BUNNY_STORAGE_ENDPOINT || 'https://storage.bunnycdn.com').replace(/\/$/, ''),
    cdnUrl,
  };
}

export async function getActiveStorageSettings(): Promise<S3Settings> {
  const settings = await SettingsModel.findOne();
  const driver = settings?.storageDriver || 'local';

  if (driver === 'digitalocean') {
    return getDOSettings();
  }
  if (driver === 'bunny') {
    return getBunnySettings();
  }
  return getS3Settings();
}

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

export async function getDOClient() {
  const settings = await getDOSettings();
  return new S3Client({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    endpoint: settings.endpoint,
    forcePathStyle: settings.pathStyle,
  });
}

export async function getCloudStorageClient() {
  const settings = await getActiveStorageSettings();
  if (settings.storageDriver === 'digitalocean') {
    return getDOClient();
  }
  if (settings.storageDriver === 'bunny') {
    throw new Error('Bunny Storage does not use an S3 client');
  }
  return getS3Client();
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
  const settings = await getActiveStorageSettings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver === 'local') {
    logger.warn('Cloud storage credentials not found or local storage selected, returning mock URL');
    return {
      uploadUrl: `https://mock-storage.local/upload/${key}?token=dev-placeholder`,
      publicUrl: `https://mock-storage.local/${key}`,
      key,
    };
  }

  if (settings.storageDriver === 'bunny') {
    throw new Error('Bunny Storage does not support S3 presigned uploads; upload through the application API instead');
  }

  try {
    const client = settings.storageDriver === 'digitalocean' ? await getDOClient() : await getS3Client();
    const command = new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn });
    const publicUrl = getPublicUrl(settings, key);

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
   body: UploadBody,
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
    return getS3PublicUrl(key);
  } catch (error) {
    logger.error(error, 'Error uploading to S3');
    throw error;
  }
}

export async function uploadToDO(
  key: string,
   body: UploadBody,
   contentType: string
): Promise<string> {
   const settings = await getDOSettings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 'digitalocean') {
    logger.warn('DigitalOcean credentials not found or DO not selected, skipping upload');
    throw new Error('DigitalOcean credentials not configured');
  }

  try {
    const doClient = await getDOClient();
    const command = new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await doClient.send(command);
    return getDOPublicUrl(key);
  } catch (error) {
    logger.error(error, 'Error uploading to DigitalOcean');
    throw error;
  }
}

const normalizeObjectKey = (key: string, bucket?: string): string => {
  let normalized = key.trim();
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      return key;
    }
  }

  normalized = normalized.replace(/^\/+/, '').replace(/^uploads\//, '');
  if (bucket && normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  }
  return normalized;
};

const getBunnyStorageUrl = (settings: S3Settings, key: string): string => {
  const endpoint = settings.endpoint?.replace(/\/$/, '') || 'https://storage.bunnycdn.com';
  const encodedKey = normalizeObjectKey(key, settings.bucket)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${endpoint}/${encodeURIComponent(settings.bucket)}/${encodedKey}`;
};

export async function uploadToBunny(
  key: string,
   body: UploadBody,
   contentType: string,
   cacheControl?: string
): Promise<string> {
  const settings = await getBunnySettings();
  if (!settings.accessKeyId || !settings.bucket || settings.storageDriver !== 'bunny') {
    logger.warn('Bunny Storage credentials not found or Bunny Storage not selected, skipping upload');
    throw new Error('Bunny Storage is not configured');
  }

  try {
    await axios.put(getBunnyStorageUrl(settings, key), body, {
      headers: {
        AccessKey: settings.accessKeyId,
        'Content-Type': contentType,
        ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return getPublicUrl(settings, key);
  } catch (error) {
    logger.error(error, 'Error uploading to Bunny Storage');
    throw error;
  }
}

export async function uploadToCloudStorage(
   key: string,
   body: UploadBody,
   contentType: string
): Promise<string> {
   const settings = await getActiveStorageSettings();
  
  if (settings.storageDriver === 'digitalocean') {
    return uploadToDO(key, body, contentType);
  }
  if (settings.storageDriver === 'bunny') {
    return uploadToBunny(key, body, contentType);
  }
  return uploadToS3(key, body, contentType);
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
      Key: normalizeObjectKey(key, settings.bucket),
    });

    await s3Client.send(command);
  } catch (error) {
    logger.error(error, 'Error deleting from S3');
    throw error;
  }
}

export async function deleteFromDO(key: string): Promise<void> {
  const settings = await getDOSettings();
  
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 'digitalocean') {
    logger.warn('DigitalOcean credentials not found or DO not selected, skipping delete');
    return;
  }

  try {
    const doClient = await getDOClient();
    const command = new DeleteObjectCommand({
      Bucket: settings.bucket,
      Key: normalizeObjectKey(key, settings.bucket),
    });

    await doClient.send(command);
  } catch (error) {
    logger.error(error, 'Error deleting from DigitalOcean');
    throw error;
  }
}

export async function deleteFromBunny(key: string): Promise<void> {
  const settings = await getBunnySettings();
  if (!settings.accessKeyId || !settings.bucket || settings.storageDriver !== 'bunny') {
    logger.warn('Bunny Storage credentials not found or Bunny Storage not selected, skipping delete');
    return;
  }

  try {
    await axios.delete(getBunnyStorageUrl(settings, key), {
      headers: { AccessKey: settings.accessKeyId },
    });
  } catch (error) {
    logger.error(error, 'Error deleting from Bunny Storage');
    throw error;
  }
}

export async function isS3Configured(): Promise<boolean> {
  const settings = await getS3Settings();
  return !!(settings.accessKeyId && settings.secretAccessKey && settings.storageDriver === 's3');
}

export async function isDOConfigured(): Promise<boolean> {
  const settings = await getDOSettings();
  return !!(settings.accessKeyId && settings.secretAccessKey && settings.storageDriver === 'digitalocean');
}

export async function isBunnyConfigured(): Promise<boolean> {
  const settings = await getBunnySettings();
  return !!(settings.accessKeyId && settings.bucket && settings.storageDriver === 'bunny');
}

export async function isCloudStorageConfigured(): Promise<boolean> {
  const settings = await getActiveStorageSettings();
  return !!(
    settings.accessKeyId &&
    settings.secretAccessKey &&
    settings.bucket &&
    (settings.storageDriver === 's3' || settings.storageDriver === 'digitalocean' || settings.storageDriver === 'bunny')
  );
}

export function getPublicUrl(settings: S3Settings, key: string): string {
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  
  let cleanKey = key;
  if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
  if (cleanKey.startsWith('uploads/')) cleanKey = cleanKey.replace('uploads/', '');
  if (cleanKey.startsWith('/uploads/')) cleanKey = cleanKey.replace('/uploads/', '');

  if (settings.storageDriver === 'digitalocean') {
    if (settings.cdnUrl) {
      const cdn = settings.cdnUrl.replace(/\/$/, '');
      return `${cdn}/${cleanKey}`;
    }
    if (settings.pathStyle) {
      return `https://${settings.region}.digitaloceanspaces.com/${settings.bucket}/${cleanKey}`;
    }
    return `https://${settings.bucket}.${settings.region}.digitaloceanspaces.com/${cleanKey}`;
  }

  if (settings.storageDriver === 'bunny') {
    const cdn = settings.cdnUrl?.replace(/\/$/, '') || `https://${settings.bucket}.b-cdn.net`;
    return `${cdn}/${cleanKey}`;
  }

  return settings.pathStyle 
    ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}/${cleanKey}`
    : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${cleanKey}`;
}

export async function getS3PublicUrl(key: string): Promise<string> {
  const settings = await getS3Settings();
  return getPublicUrl(settings, key);
}

export async function getDOPublicUrl(key: string): Promise<string> {
  const settings = await getDOSettings();
  return getPublicUrl(settings, key);
}

export async function getBunnyPublicUrl(key: string): Promise<string> {
  const settings = await getBunnySettings();
  return getPublicUrl(settings, key);
}

export async function getCloudPublicUrl(key: string): Promise<string> {
  const settings = await getActiveStorageSettings();
  return getPublicUrl(settings, key);
}

/**
 * Returns the base public URL for the cloud storage bucket (no trailing slash).
 * Used to prefix HLS master.m3u8 and individual playlist URLs.
 */
export async function getHlsPublicBaseUrl(): Promise<string> {
  const settings = await getActiveStorageSettings();
  
  if (settings.storageDriver === 'digitalocean') {
    if (settings.cdnUrl) {
      return settings.cdnUrl.replace(/\/$/, '');
    }
    if (settings.pathStyle) {
      return `https://${settings.region}.digitaloceanspaces.com/${settings.bucket}`;
    }
    return `https://${settings.bucket}.${settings.region}.digitaloceanspaces.com`;
  }

  if (settings.storageDriver === 'bunny') {
    return (settings.cdnUrl || `https://${settings.bucket}.b-cdn.net`).replace(/\/$/, '');
  }

  const base = settings.pathStyle
    ? `https://s3.${settings.region}.amazonaws.com/${settings.bucket}`
    : `https://${settings.bucket}.s3.${settings.region}.amazonaws.com`;
  return base;
}

/**
 * Recursively uploads an entire local HLS output folder to S3.
 * Preserves the relative directory structure under the given S3 prefix.
 */
export async function uploadHlsFolderToS3(localFolderPath: string, s3Prefix: string): Promise<number> {
  const settings = await getS3Settings();
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 's3') {
    throw new Error('S3 is not configured — cannot upload HLS folder');
  }

  const s3Client = await getS3Client();
  return uploadHlsFolder(s3Client, settings, localFolderPath, s3Prefix);
}

/**
 * Recursively uploads an entire local HLS output folder to DigitalOcean Spaces.
 */
export async function uploadHlsFolderToDO(localFolderPath: string, doPrefix: string): Promise<number> {
  const settings = await getDOSettings();
  if (!settings.accessKeyId || !settings.secretAccessKey || settings.storageDriver !== 'digitalocean') {
    throw new Error('DigitalOcean Spaces is not configured — cannot upload HLS folder');
  }

  const doClient = await getDOClient();
  return uploadHlsFolder(doClient, settings, localFolderPath, doPrefix);
}

export async function uploadHlsFolderToCloudStorage(localFolderPath: string, prefix: string): Promise<number> {
  const settings = await getActiveStorageSettings();
  if (settings.storageDriver === 'bunny') {
    return uploadHlsFolderToBunny(localFolderPath, prefix);
  }
  if (settings.storageDriver === 'digitalocean') {
    return uploadHlsFolderToDO(localFolderPath, prefix);
  }
  return uploadHlsFolderToS3(localFolderPath, prefix);
}

async function uploadHlsFolderToBunny(localFolderPath: string, prefix: string): Promise<number> {
  let uploadCount = 0;

  const uploadDir = async (dirPath: string, keyPrefix: string): Promise<void> => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const objectKey = `${keyPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await uploadDir(fullPath, objectKey);
        return;
      }
      if (!entry.isFile()) return;

      const ext = path.extname(entry.name).toLowerCase();
      const contentType = ext === '.m3u8'
        ? 'application/x-mpegURL'
        : ext === '.ts'
          ? 'video/MP2T'
          : 'application/octet-stream';
      await uploadToBunny(
        objectKey,
        fs.readFileSync(fullPath),
        contentType,
        ext === '.m3u8' ? 'no-cache' : 'max-age=31536000'
      );
      uploadCount++;
      logger.debug(`Uploaded HLS file: ${objectKey}`);
    }));
  };

  await uploadDir(localFolderPath, prefix);
  logger.info({ prefix, uploadCount }, 'HLS folder uploaded to Bunny Storage');
  return uploadCount;
}

async function uploadHlsFolder(
  client: ReturnType<typeof getS3Client> extends Promise<infer T> ? T : any,
  settings: S3Settings,
  localFolderPath: string,
  prefix: string
): Promise<number> {
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
      const objectKey   = `${keyPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await uploadDir(fullPath, objectKey);
      } else if (entry.isFile()) {
        const body        = fs.readFileSync(fullPath);
        const contentType = getContentType(entry.name);
        const ext         = path.extname(entry.name).toLowerCase();
        await client.send(
          new PutObjectCommand({
            Bucket:      settings.bucket,
            Key:         objectKey,
            Body:        body,
            ContentType: contentType,
            CacheControl: ext === '.m3u8' ? 'no-cache' : 'max-age=31536000',
          })
        );
        uploadCount++;
        logger.debug(`Uploaded HLS file: ${objectKey}`);
      }
    });
    await Promise.all(promises);
  };

  await uploadDir(localFolderPath, prefix);
  logger.info({ prefix, uploadCount }, 'HLS folder uploaded');
  return uploadCount;
}
