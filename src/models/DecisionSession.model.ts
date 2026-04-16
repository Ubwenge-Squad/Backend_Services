import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IThumbsEntry {
  candidateId: string;
  signal: 'up' | 'down' | 'neutral';
  timestamp: Date;
  recruiterComment?: string;
}

export interface ISessionMessage {
  _id: string;
  role: 'recruiter' | 'ai';
  content: string;
  timestamp: Date;
  triggeredBy?: 'thumbs_up' | 'thumbs_down' | 'recruiter_message' | 'session_start' | 'finalise_request';
  candidatesReferenced?: string[];
  suggestedDecisions?: {
    candidateId: string;
    suggestion: 'approve' | 'reject' | 'discuss';
    confidence: number;
    reason: string;
  }[];
}

export interface IFinalDecision {
  candidateId: string;
  decision: 'approved' | 'rejected';
  justification: string;
  approvedBy: string;
  timestamp: Date;
}

export interface IDecisionSession extends Document {
  jobId: Types.ObjectId;
  screeningRunId?: Types.ObjectId;
  recruiterId: string;
  status: 'active' | 'finalised';
  startedAt: Date;
  finalisedAt?: Date;
  candidates: {
    candidateId: string;
    name: string;
    rank: number;
    overallScore: number;
    subscores: Record<string, number>;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  }[];
  thumbsLog: IThumbsEntry[];
  messages: ISessionMessage[];
  finalDecisions?: IFinalDecision[];
  pdfReport?: {
    generatedAt: Date;
    downloadUrl: string;
    summary: string;
  };
}

const ThumbsSchema = new Schema<IThumbsEntry>({
  candidateId: { type: String, required: true },
  signal: { type: String, enum: ['up', 'down', 'neutral'], required: true },
  timestamp: { type: Date, default: Date.now },
  recruiterComment: { type: String },
}, { _id: false });

const MessageSchema = new Schema<ISessionMessage>({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  role: { type: String, enum: ['recruiter', 'ai'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  triggeredBy: { type: String, enum: ['thumbs_up', 'thumbs_down', 'recruiter_message', 'session_start', 'finalise_request'] },
  candidatesReferenced: { type: [String], default: [] },
  suggestedDecisions: { type: Schema.Types.Mixed, default: [] },
}, { _id: false });

const FinalDecisionSchema = new Schema<IFinalDecision>({
  candidateId: { type: String, required: true },
  decision: { type: String, enum: ['approved', 'rejected'], required: true },
  justification: { type: String, default: '' },
  approvedBy: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const DecisionSessionSchema = new Schema<IDecisionSession>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  screeningRunId: { type: Schema.Types.ObjectId, ref: 'ScreeningRun' },
  recruiterId: { type: String, required: true, index: true },
  status: { type: String, enum: ['active', 'finalised'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  finalisedAt: { type: Date },
  candidates: { type: Schema.Types.Mixed, default: [] },
  thumbsLog: { type: [ThumbsSchema], default: [] },
  messages: { type: [MessageSchema], default: [] },
  finalDecisions: { type: [FinalDecisionSchema], default: [] },
  pdfReport: { type: Schema.Types.Mixed },
}, { timestamps: true });

DecisionSessionSchema.index({ jobId: 1, recruiterId: 1 });

export const DecisionSessionModel = mongoose.models.DecisionSession ||
  mongoose.model<IDecisionSession>('DecisionSession', DecisionSessionSchema);
