import mongoose, { Schema, Document } from 'mongoose';

export interface IPromotionFeature {
  icon: string;
  title: string;
  description: string;
}

export interface IPromotion extends Document {
  title: string;
  subtitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  features: IPromotionFeature[];
  buttonText: string;
  secondaryButtonText?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    videoUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    features: [{
      icon: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
    }],
    buttonText: { type: String, required: true },
    secondaryButtonText: { type: String },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const PromotionModel = mongoose.model<IPromotion>('Promotion', PromotionSchema);
