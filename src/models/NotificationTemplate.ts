import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationTemplate extends Document {
  type: string;
  userType: 'user' | 'admin' | 'all';
  recipients: string[];
  status: boolean;
  notifSubject: string;
  notifTemplate: string;
  emailSubject: string;
  emailTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    type: { type: String, required: true, unique: true },
    userType: {
      type: String,
      enum: ['user', 'admin', 'all'],
      default: 'user',
    },
    recipients: [{ type: String }],
    status: { type: Boolean, default: true },
    notifSubject: { type: String, required: true },
    notifTemplate: { type: String, required: true },
    emailSubject: { type: String, required: true },
    emailTemplate: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const NotificationTemplateModel = mongoose.model<INotificationTemplate>('NotificationTemplate', NotificationTemplateSchema);
