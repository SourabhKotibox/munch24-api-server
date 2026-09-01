import mongoose, { Schema, Document } from "mongoose";

export interface IMediaFolder extends Document {
  name: string;
  parentFolder?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MediaFolderSchema = new Schema<IMediaFolder>(
  {
    name: { type: String, required: true },
    parentFolder: { type: Schema.Types.ObjectId, ref: "MediaFolder", required: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Unique index per folder level
MediaFolderSchema.index({ name: 1, parentFolder: 1 }, { unique: true });

MediaFolderSchema.virtual("fileCount", {
  ref: "MediaFile",
  localField: "_id",
  foreignField: "folder",
  count: true,
});

export const MediaFolderModel = mongoose.model<IMediaFolder>("MediaFolder", MediaFolderSchema);
