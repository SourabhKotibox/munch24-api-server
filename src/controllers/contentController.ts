import type { FastifyRequest, FastifyReply } from 'fastify';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { SectionModel } from '../models/Section';
import { Types } from 'mongoose';
import { logger } from '../lib/logger';
import { createEpisodeSlices } from './categoryController';
import { toLocalUploadPath } from '../services/videoProcessor';

const syncSections = async (contentIdStr: string, sections: string[] | undefined) => {
  await SectionModel.updateMany(
    { manualContentIds: contentIdStr },
    { $pull: { manualContentIds: contentIdStr } }
  );
  if (sections && Array.isArray(sections) && sections.length > 0) {
    await SectionModel.updateMany(
      { _id: { $in: sections } },
      { $addToSet: { manualContentIds: contentIdStr } }
    );
  }
};

export const getAllContents = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      contentType?: string;
      type?: string;
      featured?: string;
      trending?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.contentType) filter.contentType = query.contentType;
    if (query.type) filter.type = query.type;
    if (query.featured === 'true') filter.featured = true;
    if (query.trending === 'true') filter.trending = true;
    if (query.search) {
      filter.$or = [
        { title: new RegExp(query.search, 'i') },
        { description: new RegExp(query.search, 'i') },
        { tags: new RegExp(query.search, 'i') },
      ];
    }

    const [contents, total] = await Promise.all([
      ContentModel.find(filter)
        .populate('genres', 'name image')
        .populate('categories', 'name thumbnail')
        .populate('languages', 'name code')
        .populate('subtitleLanguages', 'name code')
        .populate('audioLanguages', 'name code')
        .populate('cast.actor', 'name image designation')
        .populate('crew.director', 'name image designation')
        .populate('crewMembers.crewMember', 'name image designation')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ContentModel.countDocuments(filter),
    ]);

    const contentIds = contents.map((c) => c._id);
    const episodeCounts = await EpisodeModel.aggregate([
      { $match: { contentId: { $in: contentIds } } },
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
    ]);
    const episodeCountMap: Record<string, number> = {};
    for (const e of episodeCounts) {
      episodeCountMap[e._id.toString()] = e.count;
    }

    const data = contents.map((c) => ({
      ...c,
      id: c._id?.toString(),
      episodeCount: episodeCountMap[c._id?.toString()] || 0,
    }));

    return reply.send({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting all contents');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getContentById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const content = await ContentModel.findById(id)
      .populate('genres', 'name image')
      .populate('categories', 'name thumbnail')
      .populate('languages', 'name code')
      .populate('subtitleLanguages', 'name code')
      .populate('audioLanguages', 'name code')
      .populate('cast.actor', 'name image designation')
      .populate('crew.director', 'name image designation')
      .populate('crewMembers.crewMember', 'name image designation')
      .lean();
    if (!content) {
      return reply.status(404).send({ success: false, error: 'Content not found' });
    }

    const episodes = await EpisodeModel.find({ contentId: id })
      .sort({ season: 1, episode: 1 })
      .lean();

    return reply.send({
      success: true,
      data: {
        content: { ...content, id: content._id?.toString() },
        episodes: episodes.map((e) => ({ ...e, id: e._id?.toString() })),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting content by ID');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;

    // Default to drama/series for short dramas
    if (!body.type) body.type = 'series';
    if (!body.contentType) body.contentType = 'drama';

    const content = await ContentModel.create(body);
    await syncSections(content._id.toString(), body.sections);

    return reply.status(201).send({
      success: true,
      data: { ...content.toObject(), id: content._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating content');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const content = await ContentModel.findByIdAndUpdate(
      id,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!content) {
      return reply.status(404).send({ success: false, error: 'Content not found' });
    }
    
    if (body.sections !== undefined) {
      await syncSections(id, body.sections);
    }

    return reply.send({
      success: true,
      data: { ...content, id: content._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating content');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const content = await ContentModel.findByIdAndDelete(id);
    if (!content) {
      return reply.status(404).send({ success: false, error: 'Content not found' });
    }

    await syncSections(id, []);

    // Delete associated episodes
    await EpisodeModel.deleteMany({ contentId: id });

    return reply.send({ success: true, message: 'Content deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting content');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateContentStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { status, rejectionReason } = request.body as {
      status: string;
      rejectionReason?: string;
    };

    const updateData: any = { status };
    if (rejectionReason && status === 'rejected') updateData.rejectionReason = rejectionReason;

    const content = await ContentModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!content) {
      return reply.status(404).send({ success: false, error: 'Content not found' });
    }

    return reply.send({
      success: true,
      data: { ...content, id: content._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating content status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const appendContentVideo = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const content = await ContentModel.findById(id);
    if (!content) {
      return reply.status(404).send({ success: false, error: 'Content not found' });
    }

    let reelDurationMinutes = 3.5;
    let totalDurationMinutes: number | undefined;
    let freeEpisodeCount: number | undefined;
    let lockEpisodes = true;
    let videoUrl: string | undefined;
    let videoFilePath: string | undefined;
    let seasonNumber = 1;

    for await (const part of (request as any).parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'reelDurationMinutes') {
          const v = Number(part.value) || 3.5;
          // Short dramas: cap episode duration at 3 minutes 30 seconds
          reelDurationMinutes = content.contentType === 'drama' ? Math.min(v, 3.5) : v;
        }
        if (part.fieldname === 'totalDurationMinutes') {
          const v = Number(part.value);
          if (v > 0) totalDurationMinutes = v;
        }
        if (part.fieldname === 'freeEpisodeCount') freeEpisodeCount = Number(part.value);
        if (part.fieldname === 'lockEpisodes') lockEpisodes = part.value !== 'false';
        if (part.fieldname === 'videoUrl') videoUrl = part.value as string;
        if (part.fieldname === 'season') {
          const s = Number(part.value);
          if (s > 0) seasonNumber = s;
        }
      } else if (part.type === 'file' && part.fieldname === 'videoFile') {
        // Save file to a temp path for processing
        const { writeFile } = await import('fs/promises');
        const { join } = await import('path');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = (await import('path')).dirname(__filename);
        const uploadsDir = join(__dirname, '../../uploads/videos');
        const { mkdirSync } = await import('fs');
        mkdirSync(uploadsDir, { recursive: true });
        const filename = `${Date.now()}_${part.filename}`;
        const fullPath = join(uploadsDir, filename);
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        await writeFile(fullPath, Buffer.concat(chunks));
        videoFilePath = `/uploads/videos/${filename}`;
      }
    }

    const sourceVideoUrl = videoUrl || videoFilePath;
    if (!sourceVideoUrl) {
      return reply.status(400).send({ success: false, error: 'Video URL or file required' });
    }

    const episodes = await createEpisodeSlices({
      contentId: content._id as Types.ObjectId,
      sourceVideoUrl,
      sourceVideoPath: toLocalUploadPath(sourceVideoUrl) || sourceVideoUrl,
      reelDurationMinutes,
      totalDurationMinutes,
      freeEpisodeCount,
      lockEpisodes,
      seasonNumber,
    });

    return reply.send({
      success: true,
      message: `Created ${episodes.length} episodes`,
      data: episodes,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error appending content video');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateEpisodeLock = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { episodeId } = request.params as { episodeId: string };
    const { isLocked } = request.body as { isLocked: boolean };

    const episode = await EpisodeModel.findByIdAndUpdate(
      episodeId,
      { $set: { isLocked } },
      { returnDocument: 'after' }
    ).lean();

    if (!episode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    return reply.send({ success: true, data: { ...episode, id: episode._id?.toString() } });
  } catch (error: any) {
    logger.error({ error }, 'Error updating episode lock');
    return reply.status(500).send({ success: false, error: error.message });
  }
};
