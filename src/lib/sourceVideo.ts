import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { getActiveStorageSettings, isCloudStorageConfigured } from './s3';
import { extractObjectKey, getPresignedGetUrl } from './spacesMultipart';

const uploadsRoot = () => path.join(process.cwd(), 'uploads');

export const isHlsUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.m3u8');
};

export const isRawSourceVideo = (url?: string | null): boolean => {
  if (!url) return false;
  return !isHlsUrl(url);
};

export const toLocalUploadPath = (urlPath: string): string | null => {
  if (!urlPath) return null;
  
  let relPath = urlPath;
  try {
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
      const parsed = new URL(urlPath);
      relPath = parsed.pathname;
    }
  } catch (e) {
    // Ignore invalid URLs
  }

  if (relPath.startsWith('pending://')) {
    return null;
  }

  const root = uploadsRoot();
  if (relPath.startsWith('/uploads/')) relPath = relPath.replace('/uploads/', '');
  else if (relPath.startsWith('uploads/')) relPath = relPath.replace('uploads/', '');
  else if (relPath.startsWith('/media/')) relPath = relPath.replace('/', '');
  return path.join(root, relPath);
};

export async function resolveLocalVideoFile(source: string): Promise<{
  localPath: string;
  cleanup: () => void;
}> {
  // 1. Try to find the file locally (even if it's an absolute URL pointing to our /uploads folder)
  const localPath = toLocalUploadPath(source);
  if (localPath && fs.existsSync(localPath)) {
    return { localPath, cleanup: () => undefined };
  }

  const isHttp = source.startsWith('http://') || source.startsWith('https://');

  const cloudActive = await isCloudStorageConfigured();
  if (!cloudActive) {
    if (isHttp) {
      return { localPath: source, cleanup: () => undefined };
    }
    throw new Error(`Source video not found locally and cloud storage is disabled: ${source}`);
  }

  const settings = await getActiveStorageSettings();
  
  // 2. Check if the URL is an external HTTP URL (e.g. youtube, external CDN) that does NOT belong to our cloud storage
  if (isHttp) {
    const isOurCloud = 
      (settings.bucket && source.includes(settings.bucket)) ||
      (settings.cdnUrl && source.includes(settings.cdnUrl)) ||
      source.includes('digitaloceanspaces.com') ||
      source.includes('amazonaws.com');
      
    if (!isOurCloud) {
      logger.info({ event: 'SOURCE_STREAM_READY', source }, 'Using external HTTP URL directly for FFmpeg');
      return { localPath: source, cleanup: () => undefined };
    }
  }

  // 3. Generate presigned URL for our cloud storage
  const key = extractObjectKey(source, settings);
  if (!key) {
    if (isHttp) return { localPath: source, cleanup: () => undefined };
    throw new Error(`Cannot extract cloud object key from source: ${source}`);
  }

  try {
    const signedUrl = await getPresignedGetUrl(key);
    logger.info({ event: 'SOURCE_STREAM_READY', storageKey: key }, 'Using signed cloud URL for FFmpeg instead of downloading to disk');
    return {
      localPath: signedUrl,
      cleanup: () => undefined,
    };
  } catch (error) {
    if (isHttp) {
      logger.warn({ err: error, source }, 'Failed to generate presigned URL, falling back to raw HTTP URL');
      return { localPath: source, cleanup: () => undefined };
    }
    throw error;
  }
}
