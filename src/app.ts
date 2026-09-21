import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes';
import { requestContext } from './lib/context';

import { extractJwtToken } from './lib/jwtHelper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true,
  disableRequestLogging: true,
  bodyLimit: 20 * 1024 * 1024 * 1024 // 20GB
});

// Register request context lifecycle hook
fastify.addHook('onRequest', (request, reply, done) => {
  // Fast bypass for static uploads/media requests
  if (request.url && typeof request.url === 'string' && request.url.startsWith('/uploads/')) {
    return done();
  }

  const token = extractJwtToken(request);
  let user: any = null;
  if (token) {
    try {
      const decoded = (request.server as any).jwt?.decode(token);
      if (decoded) {
        user = {
          id: decoded.id || decoded._id || decoded.userId,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
          phone: decoded.phone,
          deviceId: decoded.deviceId,
        };
        // Pre-populate request.user for controllers
        (request as any).user = user;
      }
    } catch (e) {
      // Ignore token decode errors
    }
  }

  requestContext.run({ user }, () => {
    done();
  });
});

// Custom response logger: log API requests but SILENCE high-frequency static media downloads
fastify.addHook('onResponse', (request, reply, done) => {
  if (request.url && !request.url.startsWith('/uploads/')) {
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: Math.round(reply.elapsedTime),
    }, 'request completed');
  }
  done();
});

// ── JSON body parser (MUST be registered BEFORE multipart) ───────────────────
// @fastify/multipart intercepts ALL POST/PUT body streams globally.
// Without this explicit parser, JSON bodies on non-upload routes are left
// undefined, causing "Cannot destructure property of request.body" errors.
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
);

// Enable compression for faster responses
fastify.register(fastifyCompress, {
  global: false,
  encodings: ['gzip', 'deflate', 'br']
});

// Enable CORS
fastify.register(fastifyCors, {
  origin: true,
  credentials: true,
});

// Register JWT plugin
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'fallback-secret-for-development-only',
  verify: {
    extractToken: (req) => extractJwtToken(req)
  }
});

// Register Multipart for file uploads with optimized config
fastify.register(fastifyMultipart as any, {
  limits: {
    fileSize: 20 * 1024 * 1024 * 1024, // 20GB
    files: 10 // Max files per request
  }
});

// Register Static file serving with byte-range streaming and caching
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/uploads/',
  maxAge: '7d',
  immutable: true,
  acceptRanges: true,
  cacheControl: true,
  etag: true,
  lastModified: true,
  dotfiles: 'ignore',
  index: false,
  list: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.mp4') || filePath.endsWith('.m4v') || filePath.endsWith('.webm')) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
});

// Register all routes
fastify.register(router, { prefix: '/api' });

export default fastify;
