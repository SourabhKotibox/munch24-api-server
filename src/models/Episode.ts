import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import { mediaLinkerPlugin } from '../middlewares/mediaLinkerPlugin';
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEpisode extends Document {
  contentId: Types.ObjectId;
  season: number;
  episode: number;
  title: string;
  description?: string;
  thumbnail?: string;
  sourceVideoUrl?: string;
  sourceStartSeconds?: number;
  sourceEndSeconds?: number;
  hlsUrl?: string;
  hlsS3Prefix?: string;
  videoQualities?: Array<{
    quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
    url: string;
    size: number;
  }>;
  trailerUrl?: string;
  duration?: number;
  views: number;
  likes: number;
  downloadAllowed: boolean;
  subtitleLanguages: mongoose.Types.ObjectId[];
  audioLanguages: mongoose.Types.ObjectId[];
  subtitles?: Array<{ language: mongoose.Types.ObjectId; filePath: string }>;
  airDate?: Date;
  isFree: boolean;
  isLocked: boolean;
  coinsRequired: number;
  processingStatus: 'queued' | 'processing' | 'ready' | 'failed';
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    season: { type: Number, required: true, min: 1 },
    episode: { type: Number, required: true, min: 1 },
    title: { type: String, required: true },
    description: String,
    thumbnail: String,
    sourceVideoUrl: String,
    sourceStartSeconds: Number,
    sourceEndSeconds: Number,
    hlsUrl: String,
    hlsS3Prefix: String,
    videoQualities: [
      {
        quality: { type: String, enum: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'] },
        url: String,
        size: Number,
      },
    ],
    trailerUrl: String,
    duration: Number,
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    downloadAllowed: { type: Boolean, default: true },
    subtitleLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    audioLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    subtitles: [{ language: { type: Schema.Types.ObjectId, ref: 'Language' }, filePath: String }],
    airDate: Date,
    isFree: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: true, index: true },
    coinsRequired: { type: Number, default: 0 },
    processingStatus: {
      type: String,
      enum: ['queued', 'processing', 'ready', 'failed'],
      default: 'queued',
      index: true,
    },
    processingError: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

EpisodeSchema.index({ contentId: 1, season: 1, episode: 1 }, { unique: true });

EpisodeSchema.plugin(adminAuditPlugin);
EpisodeSchema.plugin(mediaLinkerPlugin);
export const EpisodeModel = mongoose.model<IEpisode>('Episode', EpisodeSchema);
