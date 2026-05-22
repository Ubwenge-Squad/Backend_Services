import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPipelineLog extends Document {
  application: Types.ObjectId;
  job: Types.ObjectId;
  fromStage: string;
  toStage: string;
  changedBy: Types.ObjectId;
  note?: string;
}

const PipelineLogSchema = new Schema<IPipelineLog>({
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  fromStage: { type: String, required: true },
  toStage: { type: String, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String },
}, { timestamps: true });

PipelineLogSchema.index({ job: 1, toStage: 1 });

export const PipelineLogModel = mongoose.models.PipelineLog || mongoose.model<IPipelineLog>('PipelineLog', PipelineLogSchema);
