import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRecruiterProfile extends Document {
  user: Types.ObjectId;
  companyName: string;
  companyLogoUrl?: string;
  department?: string;
  jobTitle?: string;
  bio?: string;
  preferSkillsOverDegrees: boolean;
  defaultBatchSize: number;
}

const RecruiterProfileSchema = new Schema<IRecruiterProfile>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  companyLogoUrl: { type: String },
  department: { type: String },
  jobTitle: { type: String },
  bio: { type: String },
  preferSkillsOverDegrees: { type: Boolean, default: true },
  defaultBatchSize: { type: Number, default: 20 }
}, { timestamps: true });

export const RecruiterProfileModel = mongoose.models.RecruiterProfile || mongoose.model<IRecruiterProfile>('RecruiterProfile', RecruiterProfileSchema);
