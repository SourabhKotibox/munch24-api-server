import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserWatchProgress extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  episodeId?: Types.ObjectId | null; // null = Movie progress; set = Episode progress
  contentModelType: 'Content' | 'Movie'; // which collection contentId refers to
  profileId?: string | null; // OTT profile isolation (null = default/unscoped)
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserWatchProgressSchema = new Schema<IUserWatchProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, refPath: 'contentModelType', index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
    profileId: { type: String, default: null, index: true },
    progressSeconds: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    progressPercent: { type: Number, required: true },
    lastWatchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Unique constraint: one active watch progress entry per user per content per episode (episodeId null = movie progress)
UserWatchProgressSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const UserWatchProgressModel = mongoose.model<IUserWatchProgress>('UserWatchProgress', UserWatchProgressSchema);
