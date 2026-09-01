import type { FastifyPluginAsync } from 'fastify';
import { requestDownload, getDownloadsList, removeDownload, removeAllDownloads } from '../controllers/downloadController';

const downloadRoutes: FastifyPluginAsync = async (fastify) => {
  // Requires authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // POST /api/app/download - Request download authorization
  fastify.post('/download', requestDownload);

  // GET /api/app/downloads - Get user's active downloads list
  fastify.get('/downloads', getDownloadsList);

  // DELETE /api/app/downloads - Remove ALL user's downloads at once
  fastify.delete('/downloads', removeAllDownloads);

  // DELETE /api/app/downloads/:id - Remove a download log
  fastify.delete('/downloads/:id', removeDownload);
};

export default downloadRoutes;
