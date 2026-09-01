import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUnlockedEpisode extends Document {
  userId: Types.ObjectId;
  episodeId: Types.ObjectId;
  unlockedAt: Date;
}

const UnlockedEpisodeSchema = new Schema<IUnlockedEpisode>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
  },
  { timestamps: { createdAt: 'unlockedAt', updatedAt: false } }
);

// A user can only unlock a specific episode once
UnlockedEpisodeSchema.index({ userId: 1, episodeId: 1 }, { unique: true });

export const UnlockedEpisodeModel = mongoose.model<IUnlockedEpisode>('UnlockedEpisode', UnlockedEpisodeSchema);
