import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

/**
 * RewardDefinition — Admin-created reward tasks that users can complete to earn coins.
 * Examples:
 *   - "Sign Up" → 100 coins (one-time)
 *   - "Daily Login" → 50 coins (daily)
 *   - "Watch 5 Episodes" → 200 coins (one-time)
 *   - "Share a Drama" → 30 coins (recurring)
 */
export interface IRewardDefinition extends Document {
  title: string;
  description: string;
  type: 'daily_login' | 'signup' | 'watch_episodes' | 'share_content' | 'profile_complete' | 'custom';
  coinsReward: number;
  requiredCount: number; // For tasks that require a count (e.g. watch N episodes). 1 for single actions.
  isActive: boolean;
  isOneTime: boolean; // true = claim once ever; false = recurring (daily)
  iconUrl?: string;
  order: number; // display order in app
  createdAt: Date;
  updatedAt: Date;
}

const RewardDefinitionSchema = new Schema<IRewardDefinition>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['daily_login', 'signup', 'watch_episodes', 'share_content', 'profile_complete', 'custom'],
      required: true,
    },
    coinsReward: { type: Number, required: true, min: 1 },
    requiredCount: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    isOneTime: { type: Boolean, default: false },
    iconUrl: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

RewardDefinitionSchema.plugin(adminAuditPlugin);
export const RewardDefinitionModel = mongoose.model<IRewardDefinition>('RewardDefinition', RewardDefinitionSchema);
