import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger';
import { getActiveStorageSettings, isCloudStorageConfigured } from './s3';
import { downloadCloudObjectToFile, extractObjectKey } from './spacesMultipart';

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

  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  const ext = path.extname(key.split('?')[0]) || '.mp4';
  const destPath = path.join(uploadsRoot(), 'temp', 'source', `${hash}${ext}`);

  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return { localPath: destPath, cleanup: () => undefined };
  }

  logger.info({ event: 'SOURCE_DOWNLOAD_STARTED', storageKey: key }, 'Downloading source video from cloud for transcoding');
  await downloadCloudObjectToFile(key, destPath);
  logger.info({ event: 'SOURCE_DOWNLOAD_COMPLETED', storageKey: key, destPath }, 'Source video downloaded for transcoding');

  return {
    localPath: destPath,
    cleanup: () => {
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      } catch {
        // keep temp file if another job is using it
      }
    },
  };
}
