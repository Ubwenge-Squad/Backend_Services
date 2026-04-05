import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IResume extends Document {
  applicant: Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType: string;
  isPrimary: boolean;
  parsedText?: string;
  parsedAt?: Date;
  parseVersion?: string;
}

const ResumeSchema = new Schema<IResume>({
  applicant: { type: Schema.Types.ObjectId, ref: 'ApplicantProfile', required: true, index: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSizeBytes: { type: Number },
  mimeType: { type: String, default: 'application/pdf' },
  isPrimary: { type: Boolean, default: false },
  parsedText: { type: String },
  parsedAt: { type: Date },
  parseVersion: { type: String }
}, { timestamps: true });

export const ResumeModel = mongoose.models.Resume || mongoose.model<IResume>('Resume', ResumeSchema);
