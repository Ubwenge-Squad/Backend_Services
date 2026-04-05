import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditTrail extends Document {
  user?: Types.ObjectId;
  action: 'application_viewed' | 'candidate_shortlisted' | 'bias_warning_dismissed' | 'screening_triggered' | 'offer_sent' | 'data_exported' | 'account_deleted';
  entityType: string; // 'application', 'job', 'screening_run', etc.
  entityId?: Types.ObjectId;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

const AuditTrailSchema = new Schema<IAuditTrail>({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: { 
    type: String, 
    enum: ['application_viewed', 'candidate_shortlisted', 'bias_warning_dismissed', 'screening_triggered', 'offer_sent', 'data_exported', 'account_deleted'], 
    required: true, 
    index: true 
  },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

AuditTrailSchema.index({ entityType: 1, entityId: 1 });

export const AuditTrailModel = mongoose.models.AuditTrail || mongoose.model<IAuditTrail>('AuditTrail', AuditTrailSchema);
