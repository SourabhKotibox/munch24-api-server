import type { FastifyRequest } from 'fastify';
import { isCloudStorageConfigured, getActiveStorageSettings, getPublicUrl, type S3Settings } from './s3';
import { isYouTubeUrl, extractYouTubeVideoId } from './youtubeExtractor';

/**
 * Normalizes and resolves any media URL (image, video, trailer, hls):
 * 1. If already full URL:
 *    - Upgrades http:// to https:// on production/remote domains (prevents Android cleartext traffic block)
 *    - Preserves localhost / 127.0.0.1 as-is for local development
 * 2. If relative path:
 *    - If cloud storage (S3 / DigitalOcean / Bunny) is configured and it's not a local HLS directory,
 *      resolves to the public CDN / S3 URL via getPublicUrl(settings, url)
 *    - Otherwise, resolves to the server's uploads endpoint with https (or proxy proto) + host
 */
export async function resolveMediaUrl(
  request: FastifyRequest,
  url: string | null | undefined,
  cachedSettings?: S3Settings | null
): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();

  // If already full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed.replace('http://', 'https://');
    }
    return trimmed;
  }

  const isLocalHls = trimmed.startsWith('hls/') || trimmed.startsWith('/uploads/hls/') || trimmed.includes('/hls/');
  const settings = cachedSettings !== undefined ? cachedSettings : await getActiveStorageSettings();

  if (settings && settings.storageDriver !== 'local' && settings.bucket && !isLocalHls) {
    let cleanKey = trimmed;
    if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
    if (cleanKey.startsWith('uploads/')) cleanKey = cleanKey.replace('uploads/', '');
    if (cleanKey.startsWith('/uploads/')) cleanKey = cleanKey.replace('/uploads/', '');
    return getPublicUrl(settings, cleanKey);
  }

  // Local /uploads/ file
  let relPath = trimmed;
  if (relPath.startsWith('hls/')) {
    relPath = `/uploads/${relPath}`;
  }
  if (!relPath.startsWith('/uploads/')) {
    relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
  }

  const rawProto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || request.hostname;
  const proto = (!host.includes('localhost') && !host.includes('127.0.0.1')) ? 'https' : rawProto;
  return `${proto}://${host}${relPath}`;
}

/**
 * Synchronous resolver factory using pre-loaded storage settings.
 * Enables clean synchronous mapping over lists of items.
 */
export function buildMediaUrlResolver(
  request: FastifyRequest,
  settings: S3Settings | null,
  isCloudActive: boolean
) {
  const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || request.hostname;
  const rawProto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
  const defaultProto = (!host.includes('localhost') && !host.includes('127.0.0.1')) ? 'https' : rawProto;

  return (url: string | null | undefined): string | null => {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    const trimmed = url.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
        return trimmed.replace('http://', 'https://');
      }
      return trimmed;
    }

    const isLocalHls = trimmed.startsWith('hls/') || trimmed.startsWith('/uploads/hls/') || trimmed.includes('/hls/');
    if (isCloudActive && settings && settings.storageDriver !== 'local' && settings.bucket && !isLocalHls) {
      let cleanKey = trimmed;
      if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
      if (cleanKey.startsWith('uploads/')) cleanKey = cleanKey.replace('uploads/', '');
      if (cleanKey.startsWith('/uploads/')) cleanKey = cleanKey.replace('/uploads/', '');
      return getPublicUrl(settings, cleanKey);
    }

    let relPath = trimmed;
    if (relPath.startsWith('hls/')) {
      relPath = `/uploads/${relPath}`;
    }
    if (!relPath.startsWith('/uploads/')) {
      relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
    }

    return `${defaultProto}://${host}${relPath}`;
  };
}

/**
 * Standardized helper to format trailer and video playback fields for ANY content item.
 * Guarantees that mobile apps receive all required camelCase AND snake_case properties:
 * - trailerUrl & trailer_url
 * - videoUrl & video_url
 * - hlsUrl & hls_url
 * - stream_url (directly playable stream for native video players: HLS / direct video, never raw youtube webpage)
 * - media_url (fallback playable preview)
 * - preview_url
 * - hasTrailer & has_trailer
 * - trailerType & trailer_type ('hls' | 'video' | 'youtube' | null)
 * - isYouTubeTrailer & is_youtube_trailer
 * - youTubeVideoId & youtube_video_id
 * - youTubeEmbedUrl & youtube_embed_url
 * - youtube_url
 */
export function buildTrailerPlaybackInfo(
  rawTrailer: string | null | undefined,
  rawHls: string | null | undefined,
  rawVideo: string | null | undefined,
  resolveUrl: (url: string | null | undefined) => string | null,
  hasVideoAccess = true
) {
  const resolvedTrailer = resolveUrl(rawTrailer || null);
  const resolvedHls = resolveUrl(rawHls || null);
  const resolvedVideo = resolveUrl(rawVideo || null);

  const effectiveTrailer = resolvedTrailer || resolvedHls || (hasVideoAccess ? resolvedVideo : null) || null;
  const isYt = isYouTubeUrl(effectiveTrailer);
  const ytId = isYt && effectiveTrailer ? extractYouTubeVideoId(effectiveTrailer) : null;
  const trailerType: 'youtube' | 'hls' | 'video' | null = isYt
    ? 'youtube'
    : (effectiveTrailer && effectiveTrailer.includes('.m3u8'))
    ? 'hls'
    : (effectiveTrailer ? 'video' : null);

  const playableStream = (!isYt && resolvedTrailer)
    ? resolvedTrailer
    : (resolvedHls || (!isYt ? effectiveTrailer : null) || (hasVideoAccess ? resolvedVideo : null) || null);
  const embedUrl = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null;

  return {
    trailerUrl: effectiveTrailer,
    videoUrl: hasVideoAccess ? (resolvedHls || resolvedVideo) : null,
    hlsUrl: hasVideoAccess ? resolvedHls : null,
    hasTrailer: Boolean(effectiveTrailer),
    trailerType,
    isYouTubeTrailer: isYt,
    youTubeVideoId: ytId,
    youTubeEmbedUrl: embedUrl,

    // Snake_case aliases for Flutter / Android / React Native video players
    trailer_url: effectiveTrailer,
    video_url: hasVideoAccess ? (resolvedHls || resolvedVideo) : null,
    hls_url: hasVideoAccess ? resolvedHls : null,
    stream_url: playableStream,
    media_url: playableStream || effectiveTrailer,
    preview_url: playableStream || effectiveTrailer,
    has_trailer: Boolean(effectiveTrailer),
    trailer_type: trailerType,
    is_youtube_trailer: isYt,
    youtube_url: isYt ? effectiveTrailer : null,
    youtube_video_id: ytId,
    youtube_embed_url: embedUrl,
  };
}
