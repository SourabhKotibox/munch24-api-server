import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  appendBannerShowVideo,
  bulkDeleteBanners,
  createBannerFromContent,
  createBannerShow,
  deleteBanner,
  getBannerById,
  getBannerShow,
  listBanners,
  updateBanner,
  updateEpisodeLock,
} from '../controllers/bannerController';

const bannersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/banners', { onRequest: [requirePermission('banners', 'canView')] }, listBanners);
  fastify.post('/banners', { onRequest: [requirePermission('banners', 'canCreate')] }, createBannerShow);
  fastify.post('/banners/from-content', { onRequest: [requirePermission('banners', 'canCreate')] }, createBannerFromContent);
  fastify.get('/banners/item/:bannerId', { onRequest: [requirePermission('banners', 'canView')] }, getBannerById);
  fastify.put('/banners/item/:bannerId', { onRequest: [requirePermission('banners', 'canEdit')] }, updateBanner);
  fastify.delete('/banners/item/:bannerId', { onRequest: [requirePermission('banners', 'canDelete')] }, deleteBanner);
  fastify.post('/banners/bulk-delete', { onRequest: [requirePermission('banners', 'canDelete')] }, bulkDeleteBanners);
  fastify.get('/banners/:contentId', { onRequest: [requirePermission('banners', 'canView')] }, getBannerShow);
  fastify.post('/banners/:contentId/videos', { onRequest: [requirePermission('banners', 'canCreate')] }, appendBannerShowVideo);
  fastify.patch('/episodes/:episodeId/lock', { onRequest: [requirePermission('banners', 'canEdit')] }, updateEpisodeLock);
};

export default bannersRoutes;
