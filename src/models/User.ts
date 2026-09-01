import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserProfile {
  name: string;
  avatar?: string;
  isKids: boolean;
  language?: string;
  maturityLevel: number;
}

export interface IUser extends Document {
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  passwordHash?: string;
  subscriptionPlan: 'free' | 'basic' | 'standard' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'expired';
  subscriptionExpiry?: Date;
  subscriptionPlanId?: Types.ObjectId;
  profiles: IUserProfile[];
  devices: Array<{
    deviceId: string;
    deviceType: 'mobile' | 'tablet' | 'web' | 'tv' | 'other';
    deviceName?: string;
    lastSeen: Date;
  }>;
  preferredLanguage?: string;
  languageSelectionSkipped: boolean;
  preferredRegion?: string;
  watchlistCount: number;
  totalWatchTime: number;
  videoQuality: 'auto' | 'best' | 'data_saver';
  status: 'active' | 'banned' | 'suspended';
  banReason?: string;
  referralCode?: string;
  referredBy?: string;
  lastLogin?: Date;
  loginCount: number;
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    name: { type: String, required: true },
    phone: String,
    avatar: String,
    passwordHash: String,
    subscriptionPlan: {
      type: String,
      enum: ['free', 'basic', 'standard', 'premium'],
      default: 'free',
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'expired'],
      default: 'active',
    },
    subscriptionExpiry: Date,
    subscriptionPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    profiles: [
      {
        name: { type: String, required: true },
        avatar: String,
        isKids: { type: Boolean, default: false },
        language: String,
        maturityLevel: { type: Number, default: 18 },
      },
    ],
    devices: [
      {
        deviceId: String,
        deviceType: { type: String, enum: ['mobile', 'tablet', 'web', 'tv', 'other'] },
        deviceName: String,
        lastSeen: { type: Date, default: Date.now },
      },
    ],
    preferredLanguage: { type: String, default: 'Hindi' },
    languageSelectionSkipped: { type: Boolean, default: false },
    preferredRegion: String,
    watchlistCount: { type: Number, default: 0 },
    totalWatchTime: { type: Number, default: 0 },
    videoQuality: { type: String, enum: ['auto', 'best', 'data_saver'], default: 'auto' },
    status: { type: String, enum: ['active', 'banned', 'suspended'], default: 'active' },
    banReason: String,
    referralCode: String,
    referredBy: String,
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.index({ subscriptionPlan: 1, subscriptionStatus: 1 });
UserSchema.index({ status: 1 });

UserSchema.plugin(adminAuditPlugin);
export const UserModel = mongoose.model<IUser>('User', UserSchema);
