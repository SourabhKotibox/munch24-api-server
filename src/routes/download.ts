import type { FastifyPluginAsync } from 'fastify';
import {
  requestDownload,
  getDownloadsList,
  removeDownload,
  removeAllDownloads,
} from '../controllers/downloadController';
import { authenticate } from '../middlewares/auth';

const downloadRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /download or /download/:contentId - Request download authorization
  fastify.post('/download', { preHandler: [authenticate] }, requestDownload);
  fastify.post('/download/:contentId', { preHandler: [authenticate] }, requestDownload);

  // GET /downloads or /download - Get user's active downloads list
  fastify.get('/downloads', { preHandler: [authenticate] }, getDownloadsList);
  fastify.get('/download', { preHandler: [authenticate] }, getDownloadsList);

  // DELETE /downloads or /download - Remove ALL user's downloads at once
  fastify.delete('/downloads', { preHandler: [authenticate] }, removeAllDownloads);
  fastify.delete('/download', { preHandler: [authenticate] }, removeAllDownloads);

  // DELETE /downloads/:id or /download/:id - Remove a download log or content item
  fastify.delete('/downloads/:id', { preHandler: [authenticate] }, removeDownload);
  fastify.delete('/download/:id', { preHandler: [authenticate] }, removeDownload);
};

export default downloadRoutes;
