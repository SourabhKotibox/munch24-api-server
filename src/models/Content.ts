import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import { mediaLinkerPlugin } from '../middlewares/mediaLinkerPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface IContent extends Document {
  title: string;
  originalTitle?: string;
  type: 'movie' | 'series';
  contentType: 'drama' | 'movie' | 'series';
  sections: string[];
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  bannerImage?: string;
  posterImage?: string;
  trailerUrl?: string;
  genres: mongoose.Types.ObjectId[];
  languages: mongoose.Types.ObjectId[];
  subtitleLanguages: mongoose.Types.ObjectId[];
  audioLanguages: mongoose.Types.ObjectId[];
  categories: mongoose.Types.ObjectId[];
  year?: number;
  releaseDate?: Date;
  rating?: string;
  ageRating: number;
  status: 'published' | 'draft' | 'processing' | 'moderation' | 'rejected';
  rejectionReason?: string;
  hlsUrl?: string;
  hlsS3Prefix?: string;
  videoQualities?: Array<{
    quality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
    url: string;
    size: number;
  }>;
  duration?: number;
  views: number;
  likes: number;
  shares: number;
  featured: boolean;
  trending: boolean;
  isNewContent: boolean;
  isExclusive: boolean;
  downloadAllowed: boolean;
  cast: Array<{ actor: mongoose.Types.ObjectId; character?: string; role?: string }>;
  crew: Array<{ director: mongoose.Types.ObjectId; role: string }>;
  crewMembers?: Array<{ crewMember: mongoose.Types.ObjectId; role: string }>;
  director?: string;
  producer?: string;
  studio?: string;
  country?: string;
  tags: string[];
  imdbRating?: number;
  maturityContent: string[];
  seasons?: number;
  planRequired: 'free' | 'basic' | 'standard' | 'premium';
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  seoImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, index: true },
    originalTitle: String,
    type: { type: String, enum: ['movie', 'series'], required: true },
    contentType: { type: String, enum: ['drama', 'movie', 'series'], required: true, default: 'drama' },
    sections: { type: [String], default: [] },
    description: String,
    shortDescription: String,
    thumbnail: String,
    bannerImage: String,
    posterImage: String,
    trailerUrl: String,
    genres: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
    languages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    subtitleLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    audioLanguages: [{ type: Schema.Types.ObjectId, ref: 'Language' }],
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    year: Number,
    releaseDate: Date,
    rating: String,
    ageRating: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['published', 'draft', 'processing', 'moderation', 'rejected'],
      default: 'draft',
      index: true,
    },
    rejectionReason: String,
    hlsUrl: String,
    hlsS3Prefix: String,
    videoQualities: [
      {
        quality: { type: String, enum: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'] },
        url: String,
        size: Number,
      },
    ],
    duration: Number,
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
    crewMembers: { type: [{ crewMember: { type: Schema.Types.ObjectId, ref: 'Crew' }, role: String }], default: [] },
    director: String,
    producer: String,
    studio: String,
    country: String,
    tags: { type: [String], default: [] },
    imdbRating: { type: Number, min: 0, max: 10 },
    maturityContent: { type: [String], default: [] },
    seasons: Number,
    planRequired: { type: String, enum: ['free', 'basic', 'standard', 'premium'], default: 'premium' },
    slug: { type: String, index: true },
    metaTitle: String,
    metaDescription: String,
    seoImage: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ContentSchema.index({ title: 'text', description: 'text', tags: 'text' });
ContentSchema.index({ status: 1, type: 1 });
ContentSchema.index({ genres: 1 });
ContentSchema.index({ trending: 1, featured: 1 });

ContentSchema.plugin(adminAuditPlugin);
ContentSchema.plugin(mediaLinkerPlugin);
export const ContentModel = mongoose.model<IContent>('Content', ContentSchema);
