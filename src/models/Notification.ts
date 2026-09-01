import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  type: 'content_release' | 'subscription' | 'system' | 'promotional' | 'reminder' | 'alert';
  targetAudience: 'all' | 'premium' | 'standard' | 'basic' | 'free' | 'inactive';
  targetUserIds?: Types.ObjectId[];
  scheduledAt?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  metrics: {
    targetCount: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
  };
  contentId?: Types.ObjectId;
  priority: 'low' | 'normal' | 'high';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    imageUrl: String,
    deepLink: String,
    type: {
      type: String,
      enum: ['content_release', 'subscription', 'system', 'promotional', 'reminder', 'alert'],
      default: 'system',
    },
    targetAudience: {
      type: String,
      enum: ['all', 'premium', 'standard', 'basic', 'free', 'inactive'],
      default: 'all',
    },
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    scheduledAt: Date,
    sentAt: Date,
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
      default: 'draft',
      index: true,
    },
    metrics: {
      targetCount: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      openedCount: { type: Number, default: 0 },
      clickedCount: { type: Number, default: 0 },
    },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    createdBy: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);
