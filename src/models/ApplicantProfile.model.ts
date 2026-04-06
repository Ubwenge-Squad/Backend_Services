import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEducation {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface IWorkExperience {
  company: string;
  position: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
}

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
  education: IEducation[];
  workExperience: IWorkExperience[];
  hasCareerGaps: boolean;
  careerGapMonths?: number;
  aiContentScore?: number;
  integrityFlags: string[];
  anonymizedView?: any;
}

const EducationSchema = new Schema<IEducation>({
  institution: { type: String, required: true },
  degree: { type: String },
  fieldOfStudy: { type: String },
  startDate: { type: Date },
  endDate: { type: Date }
}, { _id: false });

const WorkExperienceSchema = new Schema<IWorkExperience>({
  company: { type: String, required: true },
  position: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  description: { type: String }
}, { _id: false });

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
  education: { type: [EducationSchema], default: [] },
  workExperience: { type: [WorkExperienceSchema], default: [] },
  hasCareerGaps: { type: Boolean, default: false },
  careerGapMonths: { type: Number },
  aiContentScore: { type: Number },
  integrityFlags: { type: [String], default: [] },
  anonymizedView: { type: Schema.Types.Mixed }
}, { timestamps: true });

ApplicantProfileSchema.index({ skills: 1 });

export const ApplicantProfileModel = mongoose.models.ApplicantProfile || mongoose.model<IApplicantProfile>('ApplicantProfile', ApplicantProfileSchema);
