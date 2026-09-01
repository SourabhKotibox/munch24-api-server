import mongoose, { Schema, Document } from 'mongoose';

export interface ICurrentProgram {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  thumbnail?: string;
  genre?: string;
}

export interface ILiveChannel extends Document {
  name: string;
  slug: string;
  logo: string;
  bannerImage?: string;
  description?: string;
  category: 'news' | 'sports' | 'entertainment' | 'kids' | 'movies' | 'music' | 'devotional' | 'lifestyle' | 'education' | 'business';
  language: string;
  country: string;
  streamUrl: string;
  backupStreamUrl?: string;
  isActive: boolean;
  isPremium: boolean;
  isHD: boolean;
  is4K: boolean;
  order: number;
  views: number;
  currentViewers: number;
  tags: string[];
  currentProgram?: ICurrentProgram;
  nextProgram?: ICurrentProgram;
  planRequired: 'free' | 'basic' | 'standard' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

const LiveChannelSchema = new Schema<ILiveChannel>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    logo: { type: String, required: true },
    bannerImage: String,
    description: String,
    category: {
      type: String,
      enum: ['news', 'sports', 'entertainment', 'kids', 'movies', 'music', 'devotional', 'lifestyle', 'education', 'business'],
      required: true,
    },
    language: { type: String, default: 'English' },
    country: { type: String, default: 'India' },
    streamUrl: { type: String, required: true },
    backupStreamUrl: String,
    isActive: { type: Boolean, default: true, index: true },
    isPremium: { type: Boolean, default: false },
    isHD: { type: Boolean, default: false },
    is4K: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    currentViewers: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    currentProgram: {
      title: String,
      description: String,
      startTime: Date,
      endTime: Date,
      thumbnail: String,
      genre: String,
    },
    nextProgram: {
      title: String,
      description: String,
      startTime: Date,
      endTime: Date,
      thumbnail: String,
      genre: String,
    },
    planRequired: { type: String, enum: ['free', 'basic', 'standard', 'premium'], default: 'premium' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

LiveChannelSchema.index({ category: 1, isActive: 1 });

export const LiveChannelModel = mongoose.model<ILiveChannel>('LiveChannel', LiveChannelSchema);
