import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import path from 'path';
import { Types } from 'mongoose';
import { MediaFileModel } from '../models/MediaFile';
import { MediaFolderModel } from '../models/MediaFolder';
import { MediaUploadSessionModel } from '../models/MediaUploadSession';
import { logger } from '../lib/logger';
import { generateUniqueFileName, validateFileType, UPLOAD_TYPES } from '../lib/uploadHandler';
import { transcodeToHls } from '../lib/hlsTranscoder';
import {
  getActiveStorageSettings,
  getPublicUrl,
  isCloudStorageConfigured,
} from '../lib/s3';
import {
  abortAbandonedMultipartUploads,
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  ensureBrowserUploadCors,
  getAbandonedUploadHours,
  getPresignedPartUrl,
  getUploadPartSizeBytes,
  headCloudObject,
  listUploadedParts,
  supportsBrowserDirectUpload,
} from '../lib/spacesMultipart';
import { resolveLocalVideoFile } from '../lib/sourceVideo';

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.m4v', '.mpeg', '.mpg'];
const ALLOWED_EXTS = new Set<string>([...UPLOAD_TYPES.MEDIA_LIBRARY.allowedExts]);
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;

const isVideoFile = (fileName: string, mimeType: string) => {
  const ext = path.extname(fileName).toLowerCase();
  return VIDEO_EXTS.includes(ext) || mimeType.startsWith('video/');
};

const sanitizeMime = (fileName: string, mimeType?: string) => {
  const ext = path.extname(fileName).toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return mimeType?.startsWith('video/') ? mimeType : 'video/mp4';
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (mimeType && !mimeType.includes('javascript') && !mimeType.includes('executable')) {
    return mimeType;
  }
  return 'application/octet-stream';
};

const makeResumeToken = (folderId: string, name: string, size: number, lastModified?: number) =>
  crypto.createHash('sha256').update(`${folderId}|${name}|${size}|${lastModified || 0}`).digest('hex');

const serializeSession = (session: any, mediaFile?: any) => ({
  sessionId: session._id.toString(),
  mediaFileId: session.mediaFileId.toString(),
  key: session.key,
  uploadId: session.uploadId,
  partSize: session.partSize,
  fileSize: session.fileSize,
  originalName: session.originalName,
  mimeType: session.mimeType,
  status: session.status,
  uploadError: session.uploadError || null,
  uploadedParts: session.uploadedParts || [],
  mediaFile: mediaFile ? {
    _id: mediaFile._id,
    id: mediaFile._id.toString(),
    name: mediaFile.name,
    url: mediaFile.url,
    filePath: mediaFile.filePath,
    fileSize: mediaFile.fileSize,
    fileType: mediaFile.fileType,
    storageType: mediaFile.storageType,
    s3Key: mediaFile.s3Key,
    uploadStatus: mediaFile.uploadStatus,
    uploadError: mediaFile.uploadError,
    hlsStatus: mediaFile.hlsStatus,
    hlsError: mediaFile.hlsError,
    isHls: mediaFile.isHls,
    hlsMasterPlaylistUrl: mediaFile.hlsMasterPlaylistUrl,
    hlsQualities: mediaFile.hlsQualities,
    duration: mediaFile.duration,
  } : undefined,
});

const resolveTargetFolder = async (folderId: string, fileName: string, mimeType: string) => {
  const folder = await MediaFolderModel.findById(folderId);
  if (!folder) return null;

  const subfolders = await MediaFolderModel.find({ parentFolder: folder._id });
  const imagesSubfolder = subfolders.find((sf) => sf.name.toLowerCase() === 'images');
  const videosSubfolder = subfolders.find((sf) => sf.name.toLowerCase() === 'videos');
  const ext = path.extname(fileName).toLowerCase();
  const isVideo = mimeType.startsWith('video/') || VIDEO_EXTS.includes(ext);
  const isImage = mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext);

  if (isVideo && videosSubfolder) return videosSubfolder;
  if (isImage && imagesSubfolder) return imagesSubfolder;
  return folder;
};

const startTranscodeFromCloud = (mediaFileId: string, key: string, publicUrl: string) => {
  setImmediate(async () => {
    try {
      await MediaFileModel.findByIdAndUpdate(mediaFileId, {
        uploadStatus: 'transcoding',
        hlsStatus: 'processing',
      });
      logger.info({ event: 'TRANSCODING_STARTED', contentId: mediaFileId, mediaType: 'media-file', storageKey: key }, 'HLS transcoding started');
      const resolved = await resolveLocalVideoFile(key);
      try {
        await transcodeToHls(mediaFileId, resolved.localPath, publicUrl);
      } finally {
        resolved.cleanup();
      }
      await MediaFileModel.findByIdAndUpdate(mediaFileId, { uploadStatus: 'ready' });
      logger.info({ event: 'TRANSCODING_COMPLETED', contentId: mediaFileId, mediaType: 'media-file', storageKey: key }, 'HLS transcoding completed');
    } catch (error: any) {
      logger.error({
        event: 'TRANSCODING_FAILED',
        contentId: mediaFileId,
        mediaType: 'media-file',
        storageKey: key,
        error: error?.message,
      }, 'HLS transcoding failed');
      await MediaFileModel.findByIdAndUpdate(mediaFileId, {
        uploadStatus: 'failed',
        hlsStatus: 'failed',
        hlsError: error?.message || String(error),
        uploadError: error?.message || String(error),
      });
    }
  });
};

export const initDirectUpload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      folderId: string;
      fileName: string;
      fileSize: number;
      mimeType?: string;
      lastModified?: number;
      source?: string;
      resumeSessionId?: string;
    };

    if (!body?.folderId || !body?.fileName || !body?.fileSize) {
      return reply.status(400).send({ success: false, error: 'folderId, fileName and fileSize are required' });
    }
    if (!Types.ObjectId.isValid(body.folderId)) {
      return reply.status(400).send({ success: false, error: 'Invalid folder ID' });
    }
    if (!validateFileType(body.fileName, 'MEDIA_LIBRARY') || !ALLOWED_EXTS.has(path.extname(body.fileName).toLowerCase())) {
      return reply.status(400).send({ success: false, error: `Invalid file type. Allowed: ${[...ALLOWED_EXTS].join(', ')}` });
    }
    if (body.fileSize > MAX_FILE_SIZE) {
      return reply.status(400).send({ success: false, error: 'File exceeds the 10GB upload limit' });
    }

    const mimeType = sanitizeMime(body.fileName, body.mimeType);
    const cloudActive = await isCloudStorageConfigured();
    const settings = await getActiveStorageSettings();

    if (!cloudActive || !supportsBrowserDirectUpload(settings.storageDriver)) {
      return reply.send({
        success: true,
        data: {
          mode: 'proxy',
          reason: !cloudActive
            ? 'Cloud storage is not configured'
            : 'Current storage driver does not support browser direct uploads',
        },
      });
    }

    const targetFolder = await resolveTargetFolder(body.folderId, body.fileName, mimeType);
    if (!targetFolder) {
      return reply.status(404).send({ success: false, error: 'Folder not found' });
    }

    const resumeToken = makeResumeToken(targetFolder._id.toString(), body.fileName, body.fileSize, body.lastModified);

    if (body.resumeSessionId && Types.ObjectId.isValid(body.resumeSessionId)) {
      const existing = await MediaUploadSessionModel.findById(body.resumeSessionId);
      if (existing && existing.status === 'uploading' && existing.resumeToken === resumeToken) {
        const parts = await listUploadedParts(existing.key, existing.uploadId).catch(() => existing.uploadedParts);
        existing.uploadedParts = parts.map((part) => ({
          partNumber: part.partNumber,
          etag: part.etag,
          size: part.size,
        }));
        await existing.save();
        logger.info({
          event: 'UPLOAD_RESUMED',
          contentId: existing.mediaFileId.toString(),
          mediaType: 'media-file',
          jobId: existing._id.toString(),
          storageKey: existing.key,
        }, 'Resuming existing multipart upload');
        return reply.send({
          success: true,
          data: {
            mode: 'multipart',
            ...serializeSession(existing),
          },
        });
      }
    }

    const activeSession = await MediaUploadSessionModel.findOne({
      resumeToken,
      status: 'uploading',
    }).sort({ updatedAt: -1 });

    if (activeSession) {
      const parts = await listUploadedParts(activeSession.key, activeSession.uploadId).catch(() => activeSession.uploadedParts);
      activeSession.uploadedParts = parts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
        size: part.size,
      }));
      await activeSession.save();
      return reply.send({
        success: true,
        data: {
          mode: 'multipart',
          ...serializeSession(activeSession),
        },
      });
    }

    const fileName = generateUniqueFileName(body.fileName);
    const key = `${Date.now()}-${fileName}`;
    const multipart = await createMultipartUpload(key, mimeType);
    const expiresAt = new Date(Date.now() + getAbandonedUploadHours() * 60 * 60 * 1000);

    const mediaFile = await MediaFileModel.create({
      name: body.fileName,
      url: `pending://${key}`,
      filePath: key,
      fileSize: body.fileSize,
      fileType: mimeType,
      folder: targetFolder._id,
      source: body.source || 'media-library',
      storageType: settings.storageDriver,
      s3Key: key,
      uploadStatus: 'uploading',
      hlsStatus: isVideoFile(body.fileName, mimeType) ? 'pending' : undefined,
    });

    const session = await MediaUploadSessionModel.create({
      mediaFileId: mediaFile._id,
      folderId: targetFolder._id,
      originalName: body.fileName,
      fileName,
      fileSize: body.fileSize,
      mimeType,
      key,
      uploadId: multipart.uploadId,
      partSize: getUploadPartSizeBytes(),
      resumeToken,
      uploadedParts: [],
      status: 'uploading',
      source: body.source || 'media-library',
      expiresAt,
    });

    logger.info({
      event: 'UPLOAD_STARTED',
      contentId: mediaFile._id.toString(),
      mediaType: isVideoFile(body.fileName, mimeType) ? 'video' : 'file',
      jobId: session._id.toString(),
      storageKey: key,
      fileSize: body.fileSize,
    }, 'Direct multipart upload started');

    return reply.status(201).send({
      success: true,
      data: {
        mode: 'multipart',
        ...serializeSession(session, mediaFile),
      },
    });
  } catch (error: any) {
    logger.error({ event: 'UPLOAD_FAILED', error: error?.message }, 'Failed to initialize direct upload');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const signDirectUploadPart = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sessionId } = request.params as { sessionId: string };
    const { partNumber } = request.body as { partNumber: number };

    if (!Types.ObjectId.isValid(sessionId) || !partNumber || partNumber < 1) {
      return reply.status(400).send({ success: false, error: 'Valid sessionId and partNumber are required' });
    }

    const session = await MediaUploadSessionModel.findById(sessionId);
    if (!session || session.status !== 'uploading') {
      return reply.status(404).send({ success: false, error: 'Upload session not found or no longer active' });
    }

    const uploadUrl = await getPresignedPartUrl(session.key, session.uploadId, partNumber);
    return reply.send({
      success: true,
      data: {
        partNumber,
        uploadUrl,
        expiresIn: 3600,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to sign multipart part');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const completeDirectUpload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sessionId } = request.params as { sessionId: string };
    const { parts } = request.body as { parts: Array<{ partNumber: number; etag: string; size?: number }> };

    if (!Types.ObjectId.isValid(sessionId) || !Array.isArray(parts) || parts.length === 0) {
      return reply.status(400).send({ success: false, error: 'sessionId and completed parts are required' });
    }

    const session = await MediaUploadSessionModel.findById(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Upload session not found' });
    }
    if (session.status !== 'uploading') {
      const mediaFile = await MediaFileModel.findById(session.mediaFileId);
      return reply.send({ success: true, data: serializeSession(session, mediaFile) });
    }

    const normalizedParts = parts
      .filter((part) => part.partNumber && part.etag)
      .map((part) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      }));

    await completeMultipartUpload(session.key, session.uploadId, normalizedParts);

    const head = await headCloudObject(session.key);
    if (!head.exists) {
      throw new Error('Upload completed but the object was not found in DigitalOcean Spaces');
    }

    const settings = await getActiveStorageSettings();
    const publicUrl = getPublicUrl(settings, session.key);
    const isVideo = isVideoFile(session.originalName, session.mimeType);

    const mediaFile = await MediaFileModel.findByIdAndUpdate(
      session.mediaFileId,
      {
        url: publicUrl,
        filePath: session.key,
        s3Key: session.key,
        fileSize: head.contentLength || session.fileSize,
        fileType: head.contentType || session.mimeType,
        storageType: settings.storageDriver,
        uploadStatus: isVideo ? 'uploaded' : 'ready',
        uploadError: null,
        hlsStatus: isVideo ? 'pending' : undefined,
      },
      { returnDocument: 'after' }
    );

    session.status = isVideo ? 'uploaded' : 'ready';
    session.uploadedParts = parts.map((part) => ({
      partNumber: part.partNumber,
      etag: part.etag,
      size: part.size || 0,
    }));
    session.uploadError = undefined;
    await session.save();

    logger.info({
      event: 'UPLOAD_COMPLETED',
      contentId: session.mediaFileId.toString(),
      mediaType: isVideo ? 'video' : 'file',
      jobId: session._id.toString(),
      storageKey: session.key,
      contentLength: head.contentLength,
    }, 'Direct multipart upload completed');

    if (isVideo && mediaFile) {
      session.status = 'transcoding';
      await session.save();
      startTranscodeFromCloud(mediaFile._id.toString(), session.key, publicUrl);
    }

    return reply.send({
      success: true,
      data: serializeSession(session, mediaFile),
    });
  } catch (error: any) {
    const { sessionId } = request.params as { sessionId: string };
    logger.error({ event: 'UPLOAD_FAILED', sessionId, error: error?.message }, 'Failed to complete direct upload');
    if (Types.ObjectId.isValid(sessionId)) {
      await MediaUploadSessionModel.findByIdAndUpdate(sessionId, {
        status: 'failed',
        uploadError: error?.message || String(error),
      });
      const session = await MediaUploadSessionModel.findById(sessionId);
      if (session) {
        await MediaFileModel.findByIdAndUpdate(session.mediaFileId, {
          uploadStatus: 'failed',
          uploadError: error?.message || String(error),
        });
      }
    }
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const abortDirectUpload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sessionId } = request.params as { sessionId: string };
    if (!Types.ObjectId.isValid(sessionId)) {
      return reply.status(400).send({ success: false, error: 'Invalid session ID' });
    }

    const session = await MediaUploadSessionModel.findById(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Upload session not found' });
    }

    if (session.status === 'uploading' || session.status === 'failed') {
      await abortMultipartUpload(session.key, session.uploadId).catch((error) => {
        logger.warn({ error, key: session.key }, 'Abort multipart upload failed');
      });
    }

    if (session.status === 'uploading' || session.status === 'failed') {
      await MediaFileModel.deleteOne({
        _id: session.mediaFileId,
        uploadStatus: { $in: ['uploading', 'failed'] },
        url: { $regex: /^pending:\/\// },
      });
    }

    session.status = 'aborted';
    await session.save();

    logger.info({
      event: 'UPLOAD_FAILED',
      contentId: session.mediaFileId.toString(),
      jobId: session._id.toString(),
      storageKey: session.key,
      error: 'User cancelled upload',
    }, 'Direct upload aborted');

    return reply.send({ success: true, data: { sessionId, status: 'aborted' } });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getDirectUploadSession = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sessionId } = request.params as { sessionId: string };
    if (!Types.ObjectId.isValid(sessionId)) {
      return reply.status(400).send({ success: false, error: 'Invalid session ID' });
    }

    const session = await MediaUploadSessionModel.findById(sessionId);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Upload session not found' });
    }

    const mediaFile = await MediaFileModel.findById(session.mediaFileId);
    if (session.status === 'uploading') {
      const parts = await listUploadedParts(session.key, session.uploadId).catch(() => session.uploadedParts);
      session.uploadedParts = parts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
        size: part.size,
      }));
      await session.save();
    }

    return reply.send({ success: true, data: serializeSession(session, mediaFile) });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getMediaFileStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: 'Invalid file ID' });
    }

    const file = await MediaFileModel.findById(id).lean();
    if (!file) {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }

    const uploadComplete = file.uploadStatus === 'uploaded' || file.uploadStatus === 'ready' || file.uploadStatus === 'transcoding' || file.uploadStatus === 'processing' || (!file.uploadStatus && !String(file.url).startsWith('pending://'));
    const transcoding = file.hlsStatus === 'processing' || file.uploadStatus === 'transcoding';
    const ready = file.uploadStatus === 'ready' || file.hlsStatus === 'completed' || (!isVideoFile(file.name, file.fileType) && uploadComplete);
    const failed = file.uploadStatus === 'failed' || file.hlsStatus === 'failed';

    return reply.send({
      success: true,
      data: {
        id: file._id.toString(),
        name: file.name,
        url: file.url,
        filePath: file.filePath,
        s3Key: file.s3Key,
        storageType: file.storageType,
        uploadStatus: file.uploadStatus || (uploadComplete ? 'uploaded' : 'uploading'),
        uploadError: file.uploadError || null,
        hlsStatus: file.hlsStatus || 'pending',
        hlsError: file.hlsError || null,
        isHls: file.isHls || false,
        hlsMasterPlaylistUrl: file.hlsMasterPlaylistUrl || null,
        hlsQualities: file.hlsQualities || [],
        duration: file.duration,
        uploadComplete,
        transcoding,
        ready,
        failed,
        playbackReady: Boolean(file.isHls && file.hlsMasterPlaylistUrl) || (!isVideoFile(file.name, file.fileType) && uploadComplete),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const applyStorageCors = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const origin = request.headers.origin;
    const frontend = process.env.FRONTEND_URL;
    const origins = Array.from(new Set(['*', origin, frontend].filter(Boolean) as string[]));
    const result = await ensureBrowserUploadCors(origins);
    return reply.send({ success: true, data: result });
  } catch (error: any) {
    logger.error({ event: 'CDN_CHECK_FAILED', error: error?.message }, 'Failed to apply storage CORS');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const cleanupAbandonedUploads = async () => {
  try {
    const aborted = await abortAbandonedMultipartUploads();
    const cutoff = new Date(Date.now() - getAbandonedUploadHours() * 60 * 60 * 1000);
    const staleSessions = await MediaUploadSessionModel.find({
      status: { $in: ['uploading', 'failed'] },
      updatedAt: { $lt: cutoff },
    });

    for (const session of staleSessions) {
      await MediaFileModel.deleteOne({
        _id: session.mediaFileId,
        uploadStatus: { $in: ['uploading', 'failed'] },
        url: { $regex: /^pending:\/\// },
      });
      session.status = 'aborted';
      session.uploadError = session.uploadError || 'Abandoned upload cleaned up';
      await session.save();
    }

    if (aborted > 0 || staleSessions.length > 0) {
      logger.info({ aborted, staleSessions: staleSessions.length }, 'Abandoned upload cleanup finished');
    }
  } catch (error) {
    logger.warn({ error }, 'Abandoned upload cleanup failed');
  }
};
