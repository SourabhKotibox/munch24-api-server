import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReward extends Document {
  userId: Types.ObjectId;
  rewardDefinitionId?: Types.ObjectId; // link to admin-created reward definition (if applicable)
  type: 'daily_login' | 'watch_bonus' | 'signup_bonus' | 'task_reward';
  coinsAmount: number;
  claimedAt: Date;
}

const RewardSchema = new Schema<IReward>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rewardDefinitionId: { type: Schema.Types.ObjectId, ref: 'RewardDefinition', index: true },
    type: { type: String, enum: ['daily_login', 'watch_bonus', 'signup_bonus', 'task_reward'], required: true },
    coinsAmount: { type: Number, required: true },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const RewardModel = mongoose.model<IReward>('Reward', RewardSchema);
