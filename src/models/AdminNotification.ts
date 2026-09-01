import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminNotification extends Document {
  title: string;
  message: string;
  type: 'user_registered' | 'content_created' | 'content_updated' | 'content_deleted' | 'system';
  modelName?: string;
  action?: 'created' | 'updated' | 'deleted';
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminNotificationSchema = new Schema<IAdminNotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['user_registered', 'content_created', 'content_updated', 'content_deleted', 'system'],
      default: 'system',
    },
    modelName: String,
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted'],
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const AdminNotificationModel = mongoose.model<IAdminNotification>('AdminNotification', AdminNotificationSchema);
