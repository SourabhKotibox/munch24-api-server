import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import { mediaLinkerPlugin } from '../middlewares/mediaLinkerPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface IMovie extends Document {
  title: string;
  originalTitle?: string;
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  bannerImage?: string;
  posterImage?: string;
  trailerUrl?: string;
  genres: mongoose.Types.ObjectId[];
  categories: mongoose.Types.ObjectId[];
  sections: string[];
  languages: mongoose.Types.ObjectId[];
  subtitleLanguages: mongoose.Types.ObjectId[];
  audioLanguages: mongoose.Types.ObjectId[];
  year?: number;
  rating?: string;
  ageRating: number;
  duration?: number;
  releaseDate?: Date;
  status: 'published' | 'draft' | 'processing' | 'moderation' | 'rejected';
  processingStatus?: 'queued' | 'processing' | 'ready' | 'failed';
  processingError?: string;
  rejectionReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  hlsUrl?: string;
  videoUrl?: string;
  hlsS3Prefix?: string;
  videoQualities?: Array<{
    quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
    url: string;
    size: number;
  }>;
  views: number;
  likes: number;
  shares: number;
  featured: boolean;
  trending: boolean;
  isNewContent: boolean;
  isExclusive: boolean;
  downloadAllowed: boolean;
  cast: Array<{
    actor: mongoose.Types.ObjectId;
    character?: string;
    role?: string;
  }>;
  crew: Array<{
    director: mongoose.Types.ObjectId;
    role: string;
  }>;
  producer?: string;
  studio?: string;
  country?: string;
  tags: string[];
  imdbRating?: number;
  maturityContent: string[];
  subtitles?: Array<{ language: mongoose.Types.ObjectId; filePath: string }>;
  planRequired: 'free' | 'basic' | 'standard' | 'premium';
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  seoImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MovieSchema = new Schema<IMovie>(
  {
    title: { type: String, required: true, index: true },
    originalTitle: String,
    description: String,
    shortDescription: String,
    thumbnail: String,
    bannerImage: String,
    posterImage: String,
    trailerUrl: String,
    genres: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    sections: { type: [String], default: [] },
    languages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    subtitleLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    audioLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    year: Number,
    rating: String,
    ageRating: { type: Number, default: 0 },
    duration: Number,
    releaseDate: Date,
    status: {
      type: String,
      enum: ['published', 'draft', 'processing', 'moderation', 'rejected'],
      default: 'draft',
    },
    processingStatus: {
      type: String,
      enum: ['queued', 'processing', 'ready', 'failed'],
    },
    processingError: String,
    rejectionReason: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    rejectedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    hlsUrl: String,
    videoUrl: String,
    hlsS3Prefix: String,
    videoQualities: [
      {
        quality: { type: String, enum: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'] },
        url: String,
        size: Number,
      },
    ],
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    isNewContent: { type: Boolean, default: true },
    isExclusive: { type: Boolean, default: false },
    downloadAllowed: { type: Boolean, default: true },
    cast: [{ actor: { type: Schema.Types.ObjectId, ref: 'Actor' }, character: String, role: String }],
    crew: [{ director: { type: Schema.Types.ObjectId, ref: 'Director' }, role: String }],
    producer: String,
    studio: String,
    country: String,
    tags: { type: [String], default: [] },
    imdbRating: { type: Number, min: 0, max: 10 },
    maturityContent: { type: [String], default: [] },
    subtitles: [{ language: { type: Schema.Types.ObjectId, ref: 'Language' }, filePath: String }],
    planRequired: { type: String, enum: ['free', 'basic', 'standard', 'premium'], default: 'premium' },
    slug: { type: String, index: true },
    metaTitle: String,
    metaDescription: String,
    seoImage: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

MovieSchema.index({ title: 'text', description: 'text', tags: 'text' });
MovieSchema.index({ status: 1 });
MovieSchema.index({ genres: 1 });
MovieSchema.index({ categories: 1 });
MovieSchema.index({ trending: 1, featured: 1 });
MovieSchema.index({ releaseDate: -1 });

MovieSchema.plugin(adminAuditPlugin);
MovieSchema.plugin(mediaLinkerPlugin);
export const MovieModel = mongoose.model<IMovie>('Movie', MovieSchema);
