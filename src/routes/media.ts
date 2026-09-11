import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  getFolders,
  createFolder,
  deleteFolder,
  getFilesByFolder,
  getAllMediaFiles,
  uploadFilesToFolder,
  deleteFile,
  seedDefaultFolders,
} from '../controllers/mediaController';
import {
  initDirectUpload,
  signDirectUploadPart,
  completeDirectUpload,
  abortDirectUpload,
  getDirectUploadSession,
  getMediaFileStatus,
} from '../controllers/directUploadController';

const media: FastifyPluginAsync = async (fastify) => {
  // Seed default folders on startup
  seedDefaultFolders().catch((err) => console.error('Error seeding media folders:', err));

  // Folder routes
  fastify.get('/folders', { onRequest: [requirePermission('mediaLibrary', 'canView')] }, getFolders);
  fastify.post('/folders', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, createFolder);
  fastify.delete('/folders/:id', { onRequest: [requirePermission('mediaLibrary', 'canDelete')] }, deleteFolder);

  // File routes
  fastify.get('/folders/:id/files', { onRequest: [requirePermission('mediaLibrary', 'canView')] }, getFilesByFolder);
  fastify.get('/files/all', { onRequest: [requirePermission('mediaLibrary', 'canView')] }, getAllMediaFiles);
  fastify.post('/folders/:id/files', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, uploadFilesToFolder);
  fastify.delete('/files/:id', { onRequest: [requirePermission('mediaLibrary', 'canDelete')] }, deleteFile);
  fastify.get('/files/:id/status', { onRequest: [requirePermission('mediaLibrary', 'canView')] }, getMediaFileStatus);

  fastify.post('/direct-upload/init', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, initDirectUpload);
  fastify.post('/direct-upload/:sessionId/sign-part', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, signDirectUploadPart);
  fastify.post('/direct-upload/:sessionId/complete', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, completeDirectUpload);
  fastify.post('/direct-upload/:sessionId/abort', { onRequest: [requirePermission('mediaLibrary', 'canCreate')] }, abortDirectUpload);
  fastify.get('/direct-upload/:sessionId', { onRequest: [requirePermission('mediaLibrary', 'canView')] }, getDirectUploadSession);
};

export default media;
