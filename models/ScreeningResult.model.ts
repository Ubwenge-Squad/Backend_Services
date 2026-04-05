import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScreeningResult extends Document {
  screeningRun: Types.ObjectId;
  application: Types.ObjectId;
  rankPosition?: number;
  fitScore: number;
  baseScoreNoEdu?: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  aiReasoning: string;
  strengths: string[];
  gaps: string[];
  biasWarning?: string;
  biasCategory?: 'credential_bias' | 'demographic_bias' | 'career_gap_bias' | 'linguistic_bias' | 'other';
  biasWarningDismissed: boolean;
  biasWarningDismissedAt?: Date;
  biasWarningDismissedBy?: Types.ObjectId;
  responseTimeMinutes?: number;
  predictedJoinProbability?: number;
  counterOfferRisk?: number;
  counterfactualScenarios?: any; // e.g. [{"if_condition": "2 more years Python", "new_score": 90}]
  featureAttribution?: any;      // SHAP/LIME visualization data
  adjacentRoles: string[];
  upskillingPaths: any[];
  teamChemistryScore?: number;
  tokensUsed?: number;
}

const ScreeningResultSchema = new Schema<IScreeningResult>({
  screeningRun: { type: Schema.Types.ObjectId, ref: 'ScreeningRun', required: true, index: true },
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
  rankPosition: { type: Number },
  fitScore: { type: Number, required: true, index: true },
  baseScoreNoEdu: { type: Number },
  confidenceLevel: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  aiReasoning: { type: String, required: true },
  strengths: { type: [String], default: [] },
  gaps: { type: [String], default: [] },
  biasWarning: { type: String },
  biasCategory: { type: String, enum: ['credential_bias', 'demographic_bias', 'career_gap_bias', 'linguistic_bias', 'other'] },
  biasWarningDismissed: { type: Boolean, default: false },
  biasWarningDismissedAt: { type: Date },
  biasWarningDismissedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  responseTimeMinutes: { type: Number },
  predictedJoinProbability: { type: Number },
  counterOfferRisk: { type: Number },
  counterfactualScenarios: { type: Schema.Types.Mixed },
  featureAttribution: { type: Schema.Types.Mixed },
  adjacentRoles: { type: [String], default: [] },
  upskillingPaths: { type: [Schema.Types.Mixed], default: [] },
  teamChemistryScore: { type: Number },
  tokensUsed: { type: Number }
}, { timestamps: true });

ScreeningResultSchema.index({ screeningRun: 1, application: 1 }, { unique: true });
ScreeningResultSchema.index({ screeningRun: 1, rankPosition: 1 });

export const ScreeningResultModel = mongoose.models.ScreeningResult || mongoose.model<IScreeningResult>('ScreeningResult', ScreeningResultSchema);
