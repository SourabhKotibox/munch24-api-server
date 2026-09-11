import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  getAllEpisodes,
  getEpisodeById,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  getSeasons,
  getEpisodeProcessingStatus,
} from '../controllers/episodeController';

const episodes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [requirePermission('shows', 'canView')] }, getAllEpisodes);
  fastify.post('/', { onRequest: [requirePermission('shows', 'canCreate')] }, createEpisode);
  fastify.get('/seasons', { onRequest: [requirePermission('shows', 'canView')] }, getSeasons);
  fastify.get('/:id/processing-status', { onRequest: [requirePermission('shows', 'canView')] }, getEpisodeProcessingStatus);
  fastify.get('/:id', { onRequest: [requirePermission('shows', 'canView')] }, getEpisodeById);
  fastify.put('/:id', { onRequest: [requirePermission('shows', 'canEdit')] }, updateEpisode);
  fastify.delete('/:id', { onRequest: [requirePermission('shows', 'canDelete')] }, deleteEpisode);
};

export default episodes;
