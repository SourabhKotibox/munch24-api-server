import mongoose, { Schema, Document } from 'mongoose';

export interface IAd extends Document {
  adName: string;
  adType: 'Video' | 'Image' | 'Custom';
  urlType: 'Local' | 'URL';
  mediaUrl: string; // The URL to the video/image, or the raw Custom code (Google Ads)
  placement: string; // 'Player', 'Home Page', 'Banner', etc.
  redirectUrl?: string;
  targetContentType?: string; // 'Movie', 'TV Shows', 'Video', 'Live TV', 'All'
  targetCategories?: string[]; // Array of category names or tags
  startDate: Date;
  endDate: Date;
  status: 'active' | 'inactive';
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

const AdSchema = new Schema<IAd>(
  {
    adName: { type: String, required: true },
    adType: { type: String, enum: ['Video', 'Image', 'Custom'], required: true },
    urlType: { type: String, enum: ['Local', 'URL'], required: true },
    mediaUrl: { type: String, required: true },
    placement: { type: String, required: true },
    redirectUrl: { type: String },
    targetContentType: { type: String, default: 'All' },
    targetCategories: [{ type: String }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AdModel = mongoose.model<IAd>('Ad', AdSchema);
