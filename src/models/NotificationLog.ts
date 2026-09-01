import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationLog extends Document {
  type: string;
  isHighlight: boolean;
  title: string;
  text: string;
  userName: string;
  userEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    type: { type: String, required: true, index: true },
    isHighlight: { type: Boolean, default: false },
    title: { type: String, required: true },
    text: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const NotificationLogModel = mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);
