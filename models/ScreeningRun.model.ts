import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScreeningRun extends Document {
  job: Types.ObjectId;
  triggeredBy: Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  batchSize: number;
  totalCandidates: number;
  processedCount: number;
  modelVersion: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalCostUsd?: number;
}

const ScreeningRunSchema = new Schema<IScreeningRun>({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  batchSize: { type: Number, default: 20 },
  totalCandidates: { type: Number, default: 0 },
  processedCount: { type: Number, default: 0 },
  modelVersion: { type: String, default: 'gemini-1.5-pro' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  errorMessage: { type: String },
  promptTokens: { type: Number },
  completionTokens: { type: Number },
  totalCostUsd: { type: Number }
}, { timestamps: true });

export const ScreeningRunModel = mongoose.models.ScreeningRun || mongoose.model<IScreeningRun>('ScreeningRun', ScreeningRunSchema);
