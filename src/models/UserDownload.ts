import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserDownload extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  episodeId?: Types.ObjectId | null; // null = Movie download; set = Episode download
  contentModelType: 'Content' | 'Movie'; // which collection contentId refers to
  profileId?: string | null; // OTT profile isolation (null = default/unscoped)
  createdAt: Date;
  updatedAt: Date;
}

const UserDownloadSchema = new Schema<IUserDownload>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
    profileId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

// Unique constraint: one active download record per user per content per episode (episodeId null = movie download)
UserDownloadSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const UserDownloadModel = mongoose.model<IUserDownload>('UserDownload', UserDownloadSchema);
