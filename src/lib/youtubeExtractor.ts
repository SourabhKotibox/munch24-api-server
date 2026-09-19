import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

export const isYouTubeUrl = (url?: string | null): boolean => {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be' ||
      host === 'www.youtu.be'
    );
  } catch {
    return false;
  }
};

export const extractYouTubeVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }

    if (parsed.pathname.startsWith('/shorts/')) {
      const parts = parsed.pathname.replace('/shorts/', '').split('/').filter(Boolean);
      return parts[0] || null;
    }

    if (parsed.pathname.startsWith('/embed/')) {
      const parts = parsed.pathname.replace('/embed/', '').split('/').filter(Boolean);
      return parts[0] || null;
    }

    const v = parsed.searchParams.get('v');
    if (v) return v;

    return null;
  } catch {
    return null;
  }
};

const runProcess = (command: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${command} failed with exit code ${code}`));
    });
  });
};

export const checkYtDlp = async (): Promise<string | null> => {
  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    return process.env.YT_DLP_PATH;
  }
  try {
    await runProcess('yt-dlp', ['--version']);
    return 'yt-dlp';
  } catch {
    return null;
  }
};

/**
 * Downloads a YouTube or YouTube Shorts video to a local MP4 file in tempDir using yt-dlp.
 * Returns the absolute path of the downloaded MP4 file.
 */
export async function downloadYouTubeMedia(
  url: string,
  tempDir: string,
  ffmpegPath?: string
): Promise<string> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(`Could not extract valid YouTube video ID from URL: ${url}`);
  }

  // 1. Verify yt-dlp availability before attempting extraction
  const ytDlpBinary = await checkYtDlp();
  if (!ytDlpBinary) {
    throw new Error(
      'YouTube processing requires yt-dlp, but yt-dlp is not available on this server. Please install yt-dlp or set YT_DLP_PATH.'
    );
  }

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputFilePath = path.join(tempDir, `yt_${Date.now()}_${videoId}.mp4`);

  logger.info({ videoId, ytDlpBinary }, 'Extracting YouTube media using yt-dlp');
  const args = [
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--no-playlist',
    '--no-warnings',
    '-o', outputFilePath,
    url,
  ];

  if (ffmpegPath) {
    args.unshift('--ffmpeg-location', ffmpegPath);
  }

  try {
    await runProcess(ytDlpBinary, args);
  } catch (err: any) {
    // If output file was partially created, clean it up
    if (fs.existsSync(outputFilePath)) {
      try { fs.unlinkSync(outputFilePath); } catch {}
    }
    logger.error({ err, videoId, ytDlpBinary }, 'yt-dlp extraction failed');
    throw new Error(`yt-dlp failed to download YouTube video (${videoId}): ${err.message}`);
  }

  if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size === 0) {
    throw new Error(`yt-dlp completed but output media file was not found or is empty: ${outputFilePath}`);
  }

  logger.info({ outputFilePath, videoId }, 'YouTube media downloaded successfully via yt-dlp');
  return outputFilePath;
}
