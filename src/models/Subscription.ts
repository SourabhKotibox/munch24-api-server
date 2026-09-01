import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  plan: string;
  duration: string;
  durationValue: number;
  paymentMethod: string;
  startDate: Date;
  endDate: Date;
  price: number;
  discount: number;
  couponDiscount: number;
  tax: number;
  totalAmount: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    plan: { type: String, required: true },
    duration: { type: String, required: true },
    durationValue: { type: Number, required: true, min: 1, default: 1 },
    paymentMethod: { type: String, default: '-' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponDiscount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const SubscriptionModel = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
