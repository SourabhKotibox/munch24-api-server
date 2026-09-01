import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserLike extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  episodeId?: Types.ObjectId | null; // null = series/movie like; set = episode-level like
  contentModelType: 'Content' | 'Movie'; // which collection contentId refers to
  createdAt: Date;
}

const UserLikeSchema = new Schema<IUserLike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
  },
  { timestamps: true }
);

// Unique constraint: one like per user per content per episode (episodeId null = series/movie like)
UserLikeSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const UserLikeModel = mongoose.model<IUserLike>('UserLike', UserLikeSchema);
