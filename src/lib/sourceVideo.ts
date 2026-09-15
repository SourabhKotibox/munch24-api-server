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
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || urlPath.startsWith('pending://')) {
    return null;
  }

  const root = uploadsRoot();
  let relPath = urlPath;
  if (relPath.startsWith('/uploads/')) relPath = relPath.replace('/uploads/', '');
  else if (relPath.startsWith('uploads/')) relPath = relPath.replace('uploads/', '');
  else if (relPath.startsWith('/media/')) relPath = relPath.replace('/', '');
  return path.join(root, relPath);
};

export async function resolveLocalVideoFile(source: string): Promise<{
  localPath: string;
  cleanup: () => void;
}> {
  const localPath = toLocalUploadPath(source);
  if (localPath && fs.existsSync(localPath)) {
    return { localPath, cleanup: () => undefined };
  }

  const cloudActive = await isCloudStorageConfigured();
  if (!cloudActive) {
    throw new Error(`Source video not found: ${source}`);
  }

  const settings = await getActiveStorageSettings();
  const key = extractObjectKey(source, settings);
  if (!key) {
    throw new Error(`Source video not found: ${source}`);
  }

  const signedUrl = await getPresignedGetUrl(key);
  logger.info({ event: 'SOURCE_STREAM_READY', storageKey: key }, 'Using signed cloud URL for FFmpeg instead of downloading to disk');
  return {
    localPath: signedUrl,
    cleanup: () => undefined,
  };
}
