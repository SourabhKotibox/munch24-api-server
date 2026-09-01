import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  duration: string;
  durationValue: number;
  price: number;
  discount: number; // percentage, 0-100
  totalPrice: number;
  status: boolean;
  description: string;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, index: true },
    duration: { type: String, required: true },
    durationValue: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0, max: 100 },
    totalPrice: { type: Number, required: true, min: 0 },
    status: { type: Boolean, default: true },
    description: { type: String, default: '' },
    level: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

SubscriptionPlanSchema.plugin(adminAuditPlugin);
export const SubscriptionPlanModel = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
