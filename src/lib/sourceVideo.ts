import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { getActiveStorageSettings, isCloudStorageConfigured, type S3Settings } from './s3';
import { extractObjectKey, getPresignedGetUrl } from './spacesMultipart';

const uploadsRoot = () => path.join(process.cwd(), 'uploads');

export const isHlsUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.m3u8');
};

export const isUnsupportedWebUrl = (url?: string | null): boolean => {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const unsupportedHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'vimeo.com',
      'www.vimeo.com',
      'player.vimeo.com',
      'dailymotion.com',
      'www.dailymotion.com',
      'dai.ly',
      'tiktok.com',
      'www.tiktok.com',
      'facebook.com',
      'www.facebook.com',
      'fb.watch',
      'instagram.com',
      'www.instagram.com',
      'twitter.com',
      'x.com',
    ];
    return unsupportedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

export const isCloudStorageUrl = (url: string, settings: S3Settings): boolean => {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Configured CDN URL
    if (settings.cdnUrl) {
      try {
        const cdnHost = new URL(settings.cdnUrl).hostname.toLowerCase();
        if (host === cdnHost) return true;
      } catch {
        if (url.startsWith(settings.cdnUrl)) return true;
      }
    }

    // Configured endpoint
    if (settings.endpoint) {
      try {
        const endpointHost = new URL(settings.endpoint).hostname.toLowerCase();
        if (host === endpointHost || host.endsWith(`.${endpointHost}`)) return true;
      } catch {
        if (url.startsWith(settings.endpoint)) return true;
      }
    }

    // Standard DigitalOcean Spaces domains
    if (host.endsWith('.digitaloceanspaces.com') || host === 'digitaloceanspaces.com') {
      return true;
    }

    // Standard AWS S3 domains
    if (host.endsWith('.amazonaws.com') || host === 's3.amazonaws.com') {
      return true;
    }

    // Standard Bunny storage/CDN domains
    if (host.endsWith('.b-cdn.net') || host.endsWith('.bunnycdn.com') || host === 'storage.bunnycdn.com') {
      return true;
    }

    // Bucket name in hostname
    if (settings.bucket && host.includes(settings.bucket.toLowerCase())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
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

export async function resolveLocalVideoFile(source: string, _ffmpegPath?: string): Promise<{
  localPath: string;
  cleanup: () => void;
}> {
  if (!source) {
    throw new Error('Source video not found: empty or invalid path');
  }

  // 1. Unsupported Webpage URLs (YouTube, Vimeo, etc.): reject early with clear error
  if (isUnsupportedWebUrl(source)) {
    throw new Error(
      `Web page URLs (such as YouTube, Vimeo, TikTok, etc.) cannot be transcoded directly. Please download the video and upload the video file (MP4, WebM, MOV, MKV).`
    );
  }

  // 2. Check if local file exists on disk (even if it's a full URL pointing to /uploads)
  const localPath = toLocalUploadPath(source);
  if (localPath && fs.existsSync(localPath)) {
    return { localPath, cleanup: () => undefined };
  }

  const isHttpUrl = source.startsWith('http://') || source.startsWith('https://');
  const cloudActive = await isCloudStorageConfigured();

  if (isHttpUrl) {
    if (cloudActive) {
      const settings = await getActiveStorageSettings();
      // A. Configured DigitalOcean Spaces / S3 / Bunny URL
      if (isCloudStorageUrl(source, settings)) {
        const key = extractObjectKey(source, settings);
        if (!key) {
          throw new Error(`Cloud storage object key could not be extracted from URL: ${source}`);
        }
        const signedUrl = await getPresignedGetUrl(key);
        logger.info({ event: 'SOURCE_STREAM_READY', storageKey: key }, 'Using signed cloud URL for FFmpeg instead of downloading to disk');
        return {
          localPath: signedUrl,
          cleanup: () => undefined,
        };
      }
    }

    // Direct external video file URL (e.g. https://example.com/video.mp4)
    logger.info({ event: 'EXTERNAL_STREAM_READY', sourceUrl: source }, 'Using direct external video URL for FFmpeg input');
    return {
      localPath: source,
      cleanup: () => undefined,
    };
  }

  // Raw S3/Spaces object key (non-HTTP string)
  if (!cloudActive) {
    throw new Error(`Source video not found locally and cloud storage is disabled: ${source}`);
  }

  const settings = await getActiveStorageSettings();
  const key = extractObjectKey(source, settings);
  if (!key) {
    throw new Error(`Cannot extract cloud object key from source: ${source}`);
  }

  const signedUrl = await getPresignedGetUrl(key);
  logger.info({ event: 'SOURCE_STREAM_READY', storageKey: key }, 'Using signed cloud URL for FFmpeg instead of downloading to disk');
  return {
    localPath: signedUrl,
    cleanup: () => undefined,
  };
}

