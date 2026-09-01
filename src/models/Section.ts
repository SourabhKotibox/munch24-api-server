import mongoose, { Schema, Document } from 'mongoose';

export interface ISection extends Document {
  key: string;
  title: string;
  category: string;
  contentType: 'drama' | 'movie';
  filter?: Record<string, any>;
  sortBy: Record<string, 1 | -1>;
  limit: number;
  position: number;
  isActive: boolean;
  // Layout options for the app
  layout?: 'horizontal' | 'vertical' | 'grid-2' | 'grid-3' | 'reels' | 'grid' | 'ad';
  contentSelection?: 'dynamic' | 'manual' | 'mixed';
  manualContentIds?: mongoose.Types.ObjectId[] | string[];
  showViewAll?: boolean; // Whether to show "View All" button
  itemType?: 'card' | 'poster' | 'thumbnail' | 'landscape' | 'portrait' | 'drama' | 'home-banner' | 'google-adsense';
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    contentType: {
      type: String,
      enum: ['drama', 'movie', 'mixed'],
      default: 'drama',
      index: true,
    },
    filter: { type: Schema.Types.Mixed, default: {} },
    sortBy: { type: Schema.Types.Mixed, default: { views: -1 } },
    limit: { type: Number, default: 10 },
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    // Layout fields
    layout: { 
      type: String, 
      enum: ['horizontal', 'vertical', 'grid-2', 'grid-3', 'reels', 'grid', 'ad'], 
      default: 'horizontal' 
    },
    // Content selection mode
    contentSelection: {
      type: String,
      enum: ['dynamic', 'manual', 'mixed'],
      default: 'dynamic'
    },
    manualContentIds: [{ type: Schema.Types.ObjectId, refPath: 'contentType' }],
    showViewAll: { type: Boolean, default: true },
    itemType: { 
      type: String, 
      enum: ['card', 'poster', 'thumbnail', 'landscape', 'portrait', 'drama', 'home-banner', 'google-adsense'], 
      default: 'poster' 
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

SectionSchema.index({ isActive: 1, position: 1 });
SectionSchema.index({ contentType: 1, isActive: 1, position: 1 });

export const SectionModel = mongoose.model<ISection>('Section', SectionSchema);
