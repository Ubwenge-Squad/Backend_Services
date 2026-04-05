import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApplicantProfile extends Document {
  user: Types.ObjectId;
  headline?: string;
  summary?: string;
  location?: string;
  yearsOfExperience?: number;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  skillsDnaVector?: number[]; // Representing vector(1536)
  skills: string[];
  education: any[];
  workExperience: any[];
  hasCareerGaps: boolean;
  careerGapMonths?: number;
  aiContentScore?: number;
  integrityFlags: string[];
  anonymizedView?: any;
}

const ApplicantProfileSchema = new Schema<IApplicantProfile>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  headline: { type: String },
  summary: { type: String },
  location: { type: String },
  yearsOfExperience: { type: Number },
  linkedinUrl: { type: String },
  githubUrl: { type: String },
  portfolioUrl: { type: String },
  skillsDnaVector: { type: [Number] }, 
  skills: { type: [String], default: [] },
  education: { type: [Schema.Types.Mixed], default: [] },
  workExperience: { type: [Schema.Types.Mixed], default: [] },
  hasCareerGaps: { type: Boolean, default: false },
  careerGapMonths: { type: Number },
  aiContentScore: { type: Number },
  integrityFlags: { type: [String], default: [] },
  anonymizedView: { type: Schema.Types.Mixed }
}, { timestamps: true });

ApplicantProfileSchema.index({ skills: 1 });

export const ApplicantProfileModel = mongoose.models.ApplicantProfile || mongoose.model<IApplicantProfile>('ApplicantProfile', ApplicantProfileSchema);
