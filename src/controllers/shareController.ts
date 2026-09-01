import type { FastifyReply, FastifyRequest } from 'fastify';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { logger } from '../lib/logger';

// Get these from env variables in production
const APP_PACKAGE_NAME = process.env.APP_PACKAGE_NAME || 'com.xoto.app';
const APP_SCHEME = process.env.APP_SCHEME || 'xoto';
const APP_STORE_ID = process.env.APP_STORE_ID || '123456789';

// Helper to increment share count dynamically
const incrementShareCount = async (contentId: string, contentType?: string) => {
  try {
    if (contentType === 'movie') {
      await MovieModel.findByIdAndUpdate(contentId, { $inc: { shares: 1 } });
      return;
    } else if (contentType === 'drama' || contentType === 'series' || contentType === 'tv-show') {
      await ContentModel.findByIdAndUpdate(contentId, { $inc: { shares: 1 } });
      return;
    }
    
    // Fallback: If no contentType specified, check Movie first, then Content
    const movieUpdated = await MovieModel.findByIdAndUpdate(
      contentId,
      { $inc: { shares: 1 } }
    );
    if (!movieUpdated) {
      await ContentModel.findByIdAndUpdate(
        contentId,
        { $inc: { shares: 1 } }
      );
    }
  } catch (err) {
    logger.error({ err, contentId }, 'Failed to increment share count');
  }
};

export const handleShareRedirect = async (request: FastifyRequest, reply: FastifyReply) => {
  const { contentId } = request.params as { contentId: string };
  const query = request.query as { contentType?: string };

  // Increment share count dynamically when the link is clicked/visited
  await incrementShareCount(contentId, query.contentType);

  // Android Intent URI (Automatically opens app OR Play Store if not installed)
  const androidIntent = `intent://watch/${contentId}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE_NAME};end`;
  
  // iOS Custom Scheme
  const iosScheme = `${APP_SCHEME}://watch/${contentId}`;
  const appStoreLink = `https://apps.apple.com/app/id${APP_STORE_ID}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Opening Xoto...</title>
      <style>
        body { background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .loader { border: 4px solid #333; border-top: 4px solid #ff0055; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <script>
        document.addEventListener("DOMContentLoaded", function() {
          var userAgent = navigator.userAgent || navigator.vendor || window.opera;
          
          if (/android/i.test(userAgent)) {
            // Android: Intent URI handles both opening the app and Play Store fallback automatically natively!
            window.location.replace("${androidIntent}");
          } 
          else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            // iOS: Try custom scheme, fallback to App Store after a short delay
            window.location.replace("${iosScheme}");
            setTimeout(function() {
              window.location.replace("${appStoreLink}");
            }, 2500);
          } 
          else {
            // Desktop or other: redirect to website
            window.location.replace("https://aapki-website.com/watch/${contentId}");
          }
        });
      </script>
    </head>
    <body>
      <div class="loader"></div>
    </body>
    </html>
  `;

  return reply.type('text/html').send(html);
};

export const recordShare = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { contentId } = request.params as { contentId: string };
    const body = request.body as { contentType?: 'drama' | 'movie' | 'series' | 'tv-show' } || {};
    const contentType = body.contentType;

    await incrementShareCount(contentId, contentType);

    // Fetch the updated count to return in response
    let sharesCount = 0;
    const movie = await MovieModel.findById(contentId).select('shares').lean();
    if (movie) {
      sharesCount = movie.shares ?? 0;
    } else {
      const content = await ContentModel.findById(contentId).select('shares').lean();
      sharesCount = content?.shares ?? 0;
    }

    return reply.send({
      success: true,
      message: 'Share recorded successfully.',
      data: {
        sharesCount
      }
    });
  } catch (error: any) {
    logger.error(error, 'Error recording share');
    return reply.status(500).send({
      success: false,
      message: 'Failed to record share.',
      error: error.message
    });
  }
};
