import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Sub-schemas matching competition TalentProfile spec ──────────────────────

export interface ISkill {
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  yearsOfExperience: number;
}

export interface ILanguage {
  name: string;
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
}

export interface IExperience {
  company: string;
  role: string;
  startDate: string;   // "YYYY-MM"
  endDate: string;     // "YYYY-MM" | "Present"
  description: string;
  technologies: string[];
  isCurrent: boolean;
}

export interface IEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number;
  endYear: number;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate: string;   // "YYYY-MM"
}

export interface IProject {
  name: string;
  description: string;
  technologies: string[];
  role: string;
  link?: string;
  startDate: string;
  endDate: string;
}

export interface IAvailability {
  status: 'Available' | 'Open to Opportunities' | 'Not Available';
  type: 'Full-time' | 'Part-time' | 'Contract';
  startDate?: string;  // "YYYY-MM-DD"
}

export interface ISocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  [key: string]: string | undefined;
}

export interface IApplicantProfile extends Document {
  user: Types.ObjectId;
  // ── 3.1 Basic Information ──────────────────────────────
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  bio?: string;
  location: string;
  // ── 3.2 Skills & Languages ────────────────────────────
  skills: ISkill[];
  languages?: ILanguage[];
  // ── 3.3 Work Experience ───────────────────────────────
  experience: IExperience[];
  // ── 3.4 Education ─────────────────────────────────────
  education: IEducation[];
  // ── 3.5 Certifications ────────────────────────────────
  certifications?: ICertification[];
  // ── 3.6 Projects ──────────────────────────────────────
  projects: IProject[];
  // ── 3.7 Availability ──────────────────────────────────
  availability: IAvailability;
  // ── 3.8 Social Links ──────────────────────────────────
  socialLinks?: ISocialLinks;
  // ── Extensions ────────────────────────────────────────
  source: 'umurava' | 'external';
  profileCompleteness: number;  // 0-100
}

// ── Sub-schema definitions ────────────────────────────────────────────────────

const SkillSchema = new Schema<ISkill>({
  name: { type: String, required: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], default: 'Intermediate' },
  yearsOfExperience: { type: Number, default: 0 }
}, { _id: false });

const LanguageSchema = new Schema<ILanguage>({
  name: { type: String, required: true },
  proficiency: { type: String, enum: ['Basic', 'Conversational', 'Fluent', 'Native'], default: 'Conversational' }
}, { _id: false });

const ExperienceSchema = new Schema<IExperience>({
  company: { type: String, required: true },
  role: { type: String, required: true },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: 'Present' },
  description: { type: String, default: '' },
  technologies: { type: [String], default: [] },
  isCurrent: { type: Boolean, default: false }
}, { _id: false });

const EducationSchema = new Schema<IEducation>({
  institution: { type: String, required: true },
  degree: { type: String, default: '' },
  fieldOfStudy: { type: String, default: '' },
  startYear: { type: Number, default: 0 },
  endYear: { type: Number, default: 0 }
}, { _id: false });

const CertificationSchema = new Schema<ICertification>({
  name: { type: String, required: true },
  issuer: { type: String, default: '' },
  issueDate: { type: String, default: '' }
}, { _id: false });

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  technologies: { type: [String], default: [] },
  role: { type: String, default: '' },
  link: { type: String },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' }
}, { _id: false });

const AvailabilitySchema = new Schema<IAvailability>({
  status: { type: String, enum: ['Available', 'Open to Opportunities', 'Not Available'], default: 'Available' },
  type: { type: String, enum: ['Full-time', 'Part-time', 'Contract'], default: 'Full-time' },
  startDate: { type: String }
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const ApplicantProfileSchema = new Schema<IApplicantProfile>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, default: '' },
  headline: { type: String, default: '' },
  bio: { type: String },
  location: { type: String, default: '' },
  skills: { type: [SkillSchema], default: [] },
  languages: { type: [LanguageSchema], default: [] },
  experience: { type: [ExperienceSchema], default: [] },
  education: { type: [EducationSchema], default: [] },
  certifications: { type: [CertificationSchema], default: [] },
  projects: { type: [ProjectSchema], default: [] },
  availability: { type: AvailabilitySchema, default: () => ({ status: 'Available', type: 'Full-time' }) },
  socialLinks: { type: Schema.Types.Mixed, default: {} },
  source: { type: String, enum: ['umurava', 'external'], default: 'external' },
  profileCompleteness: { type: Number, default: 0 }
}, { timestamps: true });

ApplicantProfileSchema.index({ 'skills.name': 1 });
ApplicantProfileSchema.index({ email: 1 });

export const ApplicantProfileModel = mongoose.models.ApplicantProfile || mongoose.model<IApplicantProfile>('ApplicantProfile', ApplicantProfileSchema);
