import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: 'coin_topup' | 'episode_unlock' | 'subscription' | 'gift' | 'daily_reward' | 'reward_claim';
  amount: number; // Real money amount, 0 if just spending coins
  coins: number; // Positive if adding, negative if deducting
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  referenceId?: string; // e.g. Payment Gateway transaction ID, Episode ID, or Subscription Plan ID
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['coin_topup', 'episode_unlock', 'subscription', 'gift', 'daily_reward', 'reward_claim'], required: true },
    amount: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'completed', index: true },
    referenceId: { type: String },
  },
  { timestamps: true }
);

export const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);
