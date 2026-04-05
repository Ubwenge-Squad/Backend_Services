import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJob extends Document {
  recruiter: Types.ObjectId;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minYearsExperience?: number;
  requiresDegree: boolean;
  degreeDetails?: string;
  location?: string;
  isRemote: boolean;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  status: 'draft' | 'active' | 'paused' | 'closed' | 'archived';
  publishedAt?: Date;
  closedAt?: Date;
  screeningBatchSize: number;
  aiAssisted: boolean;
  teamTraits: string[];
}

const JobSchema = new Schema<IJob>({
  recruiter: { type: Schema.Types.ObjectId, ref: 'RecruiterProfile', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: { type: String },
  responsibilities: { type: String },
  requiredSkills: { type: [String], default: [] },
  niceToHaveSkills: { type: [String], default: [] },
  minYearsExperience: { type: Number },
  requiresDegree: { type: Boolean, default: false },
  degreeDetails: { type: String },
  location: { type: String },
  isRemote: { type: Boolean, default: false },
  employmentType: { type: String },
  salaryMin: { type: Number },
  salaryMax: { type: Number },
  currency: { type: String, default: 'RWF' },
  status: { type: String, enum: ['draft', 'active', 'paused', 'closed', 'archived'], default: 'draft', index: true },
  publishedAt: { type: Date },
  closedAt: { type: Date },
  screeningBatchSize: { type: Number, default: 20 },
  aiAssisted: { type: Boolean, default: false },
  teamTraits: { type: [String], default: [] }
}, { timestamps: true });

JobSchema.index({ requiredSkills: 1 });

export const JobModel = mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
