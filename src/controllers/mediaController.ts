import type { FastifyRequest, FastifyReply } from 'fastify';
import { MediaFolderModel } from '../models/MediaFolder';
import { MediaFileModel } from '../models/MediaFile';
import { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger';
import uploadHandler from '../lib/uploadHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');
const mediaUploadDir = path.join(uploadsRoot, 'media');

// Utility functions
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Seed default folders
export const seedDefaultFolders = async () => {
  // Drop the stale solo `name_1` unique index left over from a previous schema
  // version. The current compound index { name, parentFolder } replaces it.
  try {
    await MediaFolderModel.collection.dropIndex('name_1');
    logger.info('Dropped stale name_1 index from mediafolders');
  } catch {
    // Index doesn't exist — that's fine
  }

  const defaultFolderNames = [
    'Ads',
    'Banner',
    'Cast & Crew',
    'Constant',
    'Genres',
    'Logos',
    'Movie',
    'Short Drama',
    'TV Show',
    'Users',
    'Video',
  ];

  for (const name of defaultFolderNames) {
    const folder = await MediaFolderModel.findOneAndUpdate(
      { name, parentFolder: null },
      { $setOnInsert: { name, parentFolder: null } },
      { upsert: true, returnDocument: 'after' }
    );

    // Seed nested subfolders (Images, Videos) for Movie, TV Show, and Short Drama
    if (['Movie', 'TV Show', 'Short Drama'].includes(name) && folder) {
      const subfolders = ['Images', 'Videos'];
      for (const subName of subfolders) {
        await MediaFolderModel.findOneAndUpdate(
          { name: subName, parentFolder: folder._id },
          { $setOnInsert: { name: subName, parentFolder: folder._id } },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }
  }
};

// Get all folders
export const getFolders = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as { parentFolder?: string };
    let filter: any = { parentFolder: null };

    if (query.parentFolder) {
      if (query.parentFolder === 'all') {
        filter = {};
      } else if (Types.ObjectId.isValid(query.parentFolder)) {
        filter = { parentFolder: new Types.ObjectId(query.parentFolder) };
      }
    }

    const folders = await MediaFolderModel.find(filter).sort({ name: 1 }).lean();
    const foldersWithCount = [];
    for (const folder of folders) {
      const subFolders = await MediaFolderModel.find({ parentFolder: folder._id });
      const subFolderIds = subFolders.map(sf => sf._id);
      const count = await MediaFileModel.countDocuments({
        folder: { $in: [folder._id, ...subFolderIds] }
      });

      foldersWithCount.push({
        _id: folder._id,
        name: folder.name,
        parentFolder: folder.parentFolder,
        count,
      });
    }

    return reply.send({
      success: true,
      data: foldersWithCount,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting folders');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Create folder
export const createFolder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, parentFolder } = request.body as { name: string; parentFolder?: string };
    if (!name) {
      return reply.status(400).send({ success: false, error: 'Folder name is required' });
    }

    const parentId = parentFolder && Types.ObjectId.isValid(parentFolder)
      ? new Types.ObjectId(parentFolder)
      : null;

    const existing = await MediaFolderModel.findOne({ name, parentFolder: parentId });
    if (existing) {
      return reply.status(400).send({ success: false, error: 'Folder already exists at this level' });
    }

    const folder = await MediaFolderModel.create({ name, parentFolder: parentId });
    return reply.status(201).send({
      success: true,
      data: folder,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating folder');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Delete folder
export const deleteFolder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: 'Invalid folder ID' });
    }

    const folder = await MediaFolderModel.findById(id);
    if (!folder) {
      return reply.status(404).send({ success: false, error: 'Folder not found' });
    }

    const files = await MediaFileModel.find({ folder: id });

    // Delete files from storage
    for (const file of files) {
      await uploadHandler.deleteUploadedFile(file.s3Key || file.filePath, file.storageType);
    }

    // Delete files from DB
    await MediaFileModel.deleteMany({ folder: id });

    // Delete folder from DB
    await MediaFolderModel.findByIdAndDelete(id);

    // Delete folder from disk
    const folderPath = path.join(mediaUploadDir, id);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }

    return reply.send({ success: true, message: 'Folder deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting folder');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Helper to ensure file path has /uploads/ prefix
const ensureUploadPath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith('/uploads/')) return path;
  if (path.startsWith('uploads/')) return `/${path}`;
  if (path.startsWith('/')) return `/uploads${path}`;
  return `/uploads/${path}`;
};

// Get files by folder
export const getFilesByFolder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: 'Invalid folder ID' });
    }

    const folder = await MediaFolderModel.findById(id);
    if (!folder) {
      return reply.status(404).send({ success: false, error: 'Folder not found' });
    }

    const files = await MediaFileModel.find({ folder: id }).sort({ createdAt: -1 }).lean();
    const filesWithSize = files.map((file) => {
      let fileUrl = file.url;
      let filePath = file.filePath;
      
      if (file.storageType !== 's3') {
        const normalizedPath = ensureUploadPath(file.filePath);
        const protocol = request.protocol;
        const host = request.headers.host;
        fileUrl = `${protocol}://${host}${normalizedPath}`;
        filePath = normalizedPath;
      }
      
      return {
        _id: file._id,
        id: file._id.toString(),
        name: file.name,
        url: fileUrl,
        filePath: filePath,
        size: uploadHandler.formatFileSize(file.fileSize),
        fileSize: file.fileSize,
        fileType: file.fileType,
        folder: id,
        source: file.source,
        sourceId: file.sourceId?.toString(),
        storageType: file.storageType,
        s3Key: file.s3Key,
        isHls: file.isHls,
        hlsMasterPlaylistUrl: file.hlsMasterPlaylistUrl,
        hlsMasterPlaylistPath: file.hlsMasterPlaylistPath,
        hlsQualities: file.hlsQualities,
        hlsStatus: file.hlsStatus,
        hlsError: file.hlsError,
        duration: file.duration,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };
    });

    return reply.send({
      success: true,
      data: filesWithSize,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting files');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get all media files (with optional filtering)
export const getAllMediaFiles = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      source?: string;
      fileType?: string;
      search?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (query.source) filter.source = query.source;
    if (query.fileType) filter.fileType = new RegExp(query.fileType, 'i');
    if (query.search) filter.name = new RegExp(query.search, 'i');

    const [files, total] = await Promise.all([
      MediaFileModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MediaFileModel.countDocuments(filter)
    ]);

    const filesWithSize = files.map((file) => {
      let fileUrl = file.url;
      let filePath = file.filePath;
      
      if (file.storageType !== 's3') {
        const normalizedPath = ensureUploadPath(file.filePath);
        const protocol = request.protocol;
        const host = request.headers.host;
        fileUrl = `${protocol}://${host}${normalizedPath}`;
        filePath = normalizedPath;
      }
      
      return {
        _id: file._id,
        id: file._id.toString(),
        name: file.name,
        url: fileUrl,
        filePath: filePath,
        size: uploadHandler.formatFileSize(file.fileSize),
        fileSize: file.fileSize,
        fileType: file.fileType,
        folder: file.folder?.toString(),
        source: file.source,
        sourceId: file.sourceId?.toString(),
        storageType: file.storageType,
        s3Key: file.s3Key,
        isHls: file.isHls,
        hlsMasterPlaylistUrl: file.hlsMasterPlaylistUrl,
        hlsMasterPlaylistPath: file.hlsMasterPlaylistPath,
        hlsQualities: file.hlsQualities,
        hlsStatus: file.hlsStatus,
        hlsError: file.hlsError,
        duration: file.duration,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };
    });

    return reply.send({
      success: true,
      data: filesWithSize,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting all media files');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Upload file to folder
export const uploadFilesToFolder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: 'Invalid folder ID' });
    }

    const folder = await MediaFolderModel.findById(id);
    if (!folder) {
      return reply.status(404).send({ success: false, error: 'Folder not found' });
    }

    const savedFiles = [];
    let source = 'media-library';

    // Check if this folder has nested subfolders (Images, Videos)
    const subfolders = await MediaFolderModel.find({ parentFolder: folder._id });
    const imagesSubfolder = subfolders.find(sf => sf.name.toLowerCase() === 'images');
    const videosSubfolder = subfolders.find(sf => sf.name.toLowerCase() === 'videos');

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        let targetFolderId = id;
        const isVideo = part.mimetype?.startsWith('video/') || part.filename.match(/\.(mp4|webm|mov|mkv|avi|flv)$/i);
        const isImage = part.mimetype?.startsWith('image/') || part.filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i);

        if (isVideo && videosSubfolder) {
          targetFolderId = videosSubfolder._id.toString();
        } else if (isImage && imagesSubfolder) {
          targetFolderId = imagesSubfolder._id.toString();
        }

        const customDir = `media/${targetFolderId}`;

        const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'MEDIA_LIBRARY', customDir, {
          trackInMediaLibrary: true,
          source: source,
          folderId: targetFolderId,
        });
        savedFiles.push(uploadedFile);
      } else if (part.type === 'field' && part.fieldname === 'source') {
        source = part.value as string;
      }
    }

    return reply.status(201).send({
      success: true,
      data: savedFiles,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error uploading files');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Delete file
export const deleteFile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: 'Invalid file ID' });
    }

    const file = await MediaFileModel.findById(id);
    if (!file) {
      return reply.status(404).send({ success: false, error: 'File not found' });
    }

    if (file.sourceId && file.contentName) {
      return reply.status(400).send({
        success: false,
        error: `This file is currently in use by "${file.contentName}" (${file.contentType}). Please update or remove that content before deleting this file.`
      });
    }

    // Delete file from storage
    await uploadHandler.deleteUploadedFile(file.s3Key || file.filePath, file.storageType);

    // Delete from DB
    await MediaFileModel.findByIdAndDelete(id);

    return reply.send({ success: true, message: 'File deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting file');
    return reply.status(500).send({ success: false, error: error.message });
  }
};
