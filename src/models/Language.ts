import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface ILanguage extends Document {
  name: string;
  code: string;
  image?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    name: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    image: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

LanguageSchema.plugin(adminAuditPlugin);
export const LanguageModel = mongoose.model<ILanguage>('Language', LanguageSchema);
