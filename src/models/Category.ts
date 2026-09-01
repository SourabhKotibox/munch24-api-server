import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  thumbnail?: string;
  bannerImage?: string;
  icon?: string;
  color?: string;
  contentCount: number;
  isActive: boolean;
  isFeatured: boolean;
  order: number;
  parentCategory?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    thumbnail: String,
    bannerImage: String,
    icon: String,
    color: { type: String, default: '#e50914' },
    contentCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    parentCategory: { type: Schema.Types.ObjectId, ref: 'Category' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CategorySchema.plugin(adminAuditPlugin);
export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
