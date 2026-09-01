import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface IGenre extends Document {
  name: string;
  description?: string;
  image?: string;
  active: boolean;
  status: 'published' | 'draft' | 'moderation' | 'rejected';
  rejectionReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GenreSchema = new Schema<IGenre>(
  {
    name: { type: String, required: true, index: true },
    description: String,
    image: String,
    active: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['published', 'draft', 'moderation', 'rejected'],
      default: 'draft',
      index: true,
    },
    rejectionReason: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    rejectedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

GenreSchema.plugin(adminAuditPlugin);
export const GenreModel = mongoose.model<IGenre>('Genre', GenreSchema);
