import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserReminder extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  contentModelType: 'Movie' | 'Content';
  contentType?: 'movie' | 'series' | 'drama';
  profileId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserReminderSchema = new Schema<IUserReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentModelType: { type: String, enum: ['Movie', 'Content'], required: true },
    contentType: { type: String, enum: ['movie', 'series', 'drama'], default: 'movie' },
    profileId: { type: String, default: null },
  },
  { timestamps: true }
);

// One reminder per user per content
UserReminderSchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const UserReminderModel = mongoose.model<IUserReminder>('UserReminder', UserReminderSchema);
