import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  ctaText: string;
  ctaLink?: string;
  contentId?: Types.ObjectId;
  type: 'hero' | 'featured' | 'promotional' | 'category';
  contentType: 'drama' | 'movie' | 'both';
  position: number;
  isActive: boolean;
  targetPlatforms: Array<'web' | 'mobile' | 'tv'>;
  startDate?: Date;
  endDate?: Date;
  clickCount: number;
  impressionCount: number;
  backgroundColor?: string;
  textColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    subtitle: String,
    description: String,
    imageUrl: { type: String, required: true },
    mobileImageUrl: String,
    ctaText: { type: String, default: 'Watch Now' },
    ctaLink: String,
    contentId: { type: Schema.Types.ObjectId, ref: 'Content' },
    type: {
      type: String,
      enum: ['hero', 'featured', 'promotional', 'category'],
      default: 'hero',
    },
    contentType: {
      type: String,
      enum: ['drama', 'movie', 'both'],
      default: 'both',
    },
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    targetPlatforms: {
      type: [String],
      enum: ['web', 'mobile', 'tv'],
      default: ['web', 'mobile'],
    },
    startDate: Date,
    endDate: Date,
    clickCount: { type: Number, default: 0 },
    impressionCount: { type: Number, default: 0 },
    backgroundColor: String,
    textColor: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

BannerSchema.index({ isActive: 1, position: 1 });

export const BannerModel = mongoose.model<IBanner>('Banner', BannerSchema);
