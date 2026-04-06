import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApplication extends Document {
  job: Types.ObjectId;
  applicant: Types.ObjectId;
  resume?: Types.ObjectId;
  status: 'submitted' | 'screening' | 'shortlisted' | 'interviewed' | 'offered' | 'hired' | 'rejected' | 'withdrawn';
  coverLetter?: string;
  recruiterNotes?: string;
  submittedAt: Date;
  firstResponseMinutes?: number;
}

const ApplicationSchema = new Schema<IApplication>({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  applicant: { type: Schema.Types.ObjectId, ref: 'ApplicantProfile', required: true, index: true },
  resume: { type: Schema.Types.ObjectId, ref: 'Resume' },
  status: { 
    type: String, 
    enum: ['submitted', 'screening', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'], 
    default: 'submitted',
    index: true
  },
  coverLetter: { type: String },
  recruiterNotes: { type: String },
  submittedAt: { type: Date, default: Date.now },
  firstResponseMinutes: { type: Number }
}, { timestamps: true });

ApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export const ApplicationModel = mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema);
