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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true,
  bodyLimit: 2000 * 1024 * 1024 // 2GB
});

// Register request context lifecycle hook
fastify.addHook('onRequest', (request, reply, done) => {
  const authHeader = request.headers.authorization;
  let user: any = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = (request.server as any).jwt?.decode(token);
      if (decoded) {
        user = {
          id: decoded.id || decoded._id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name
        };
      }
    } catch (e) {
      // Ignore token decode errors
    }
  }

  requestContext.run({ user }, () => {
    done();
  });
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
  secret: process.env.JWT_SECRET || 'fallback-secret-for-development-only'
});

// Register Multipart for file uploads with optimized config
fastify.register(fastifyMultipart as any, {
  limits: {
    fileSize: 2000 * 1024 * 1024, // 2GB
    files: 10 // Max files per request
  }
});

// Register Static file serving
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/uploads/'
});

// Register all routes
fastify.register(router, { prefix: '/api' });

export default fastify;
