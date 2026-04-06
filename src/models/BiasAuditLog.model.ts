import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBiasAuditLog extends Document {
  screeningRun: Types.ObjectId;
  screeningResult?: Types.ObjectId;
  topThreeAllDegreed: boolean;
  degreeVsSkillDelta?: number;
  warningMessage?: string;
  biasCategory?: 'credential_bias' | 'demographic_bias' | 'career_gap_bias' | 'linguistic_bias' | 'other';
  dismissed: boolean;
  dismissedBy?: Types.ObjectId;
  dismissedAt?: Date;
  contextualVariationTested: boolean;
  variationResults?: any;
}

const BiasAuditLogSchema = new Schema<IBiasAuditLog>({
  screeningRun: { type: Schema.Types.ObjectId, ref: 'ScreeningRun', required: true, index: true },
  screeningResult: { type: Schema.Types.ObjectId, ref: 'ScreeningResult' },
  topThreeAllDegreed: { type: Boolean, default: false },
  degreeVsSkillDelta: { type: Number },
  warningMessage: { type: String },
  biasCategory: { type: String, enum: ['credential_bias', 'demographic_bias', 'career_gap_bias', 'linguistic_bias', 'other'] },
  dismissed: { type: Boolean, default: false },
  dismissedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  dismissedAt: { type: Date },
  contextualVariationTested: { type: Boolean, default: false },
  variationResults: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const BiasAuditLogModel = mongoose.models.BiasAuditLog || mongoose.model<IBiasAuditLog>('BiasAuditLog', BiasAuditLogSchema);
