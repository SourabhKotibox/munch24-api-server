import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface ICoinPackage extends Document {
  price: number;
  coins: number;
  bonusCoins: number;
  label: string; // e.g., 'Best Value'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CoinPackageSchema = new Schema<ICoinPackage>(
  {
    price: { type: Number, required: true, min: 0 },
    coins: { type: Number, required: true, min: 1 },
    bonusCoins: { type: Number, default: 0, min: 0 },
    label: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CoinPackageSchema.plugin(adminAuditPlugin);
export const CoinPackageModel = mongoose.model<ICoinPackage>('CoinPackage', CoinPackageSchema);
