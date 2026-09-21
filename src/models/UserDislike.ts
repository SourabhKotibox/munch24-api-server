import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserDislike extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  episodeId?: Types.ObjectId | null;
  contentModelType: 'Content' | 'Movie';
  createdAt: Date;
}

const UserDislikeSchema = new Schema<IUserDislike>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
  },
  { timestamps: true }
);

// Unique constraint: one dislike per user per content per episode
UserDislikeSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const UserDislikeModel = mongoose.model<IUserDislike>('UserDislike', UserDislikeSchema);
