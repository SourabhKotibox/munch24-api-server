import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserView extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  episodeId?: Types.ObjectId | null; // null = series/movie view; set = episode-level view
  contentModelType: 'Content' | 'Movie'; // which collection contentId refers to
  createdAt: Date;
  updatedAt: Date;
}

const UserViewSchema = new Schema<IUserView>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', default: null, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
  },
  { timestamps: true }
);

// Unique constraint: one view per user per content per episode (episodeId null = series/movie view)
UserViewSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const UserViewModel = mongoose.model<IUserView>('UserView', UserViewSchema);
