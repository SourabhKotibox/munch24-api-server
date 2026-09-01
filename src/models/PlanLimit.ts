import mongoose, { Schema, Document } from 'mongoose';
import { ISubscriptionPlan } from './SubscriptionPlan';

export interface IPlanLimit extends Document {
  planId: mongoose.Types.ObjectId | ISubscriptionPlan;
  videoCast: boolean;
  ads: boolean;
  deviceLimit: boolean;
  deviceLimitCount: number;
  downloadStatus: boolean;
  supportedDeviceType: boolean;
  supportedDevices: string[];
  profileLimit: boolean;
  profileLimitCount: number;
  q480p: boolean;
  q720p: boolean;
  q1080p: boolean;
  q1440p: boolean;
  q2k: boolean;
  q4k: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanLimitSchema = new Schema<IPlanLimit>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, unique: true, index: true },
    videoCast: { type: Boolean, default: false },
    ads: { type: Boolean, default: false },
    deviceLimit: { type: Boolean, default: false },
    deviceLimitCount: { type: Number, default: 1 },
    downloadStatus: { type: Boolean, default: false },
    supportedDeviceType: { type: Boolean, default: false },
    supportedDevices: { type: [String], default: [] },
    profileLimit: { type: Boolean, default: false },
    profileLimitCount: { type: Number, default: 1 },
    q480p: { type: Boolean, default: true },
    q720p: { type: Boolean, default: false },
    q1080p: { type: Boolean, default: false },
    q1440p: { type: Boolean, default: false },
    q2k: { type: Boolean, default: false },
    q4k: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const PlanLimitModel = mongoose.model<IPlanLimit>('PlanLimit', PlanLimitSchema);
