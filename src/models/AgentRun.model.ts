import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAgentRun extends Document {
  job?: Types.ObjectId;
  agentType: 'sourcing' | 'screening' | 'scheduling' | 'orchestrator';
  status: 'queued' | 'running' | 'completed' | 'failed';
  parentRun?: Types.ObjectId;
  inputPayload: any;
  outputPayload?: any;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  tokensUsed?: number;
}

const AgentRunSchema = new Schema<IAgentRun>({
  job: { type: Schema.Types.ObjectId, ref: 'Job', index: true },
  agentType: { type: String, enum: ['sourcing', 'screening', 'scheduling', 'orchestrator'], required: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
  parentRun: { type: Schema.Types.ObjectId, ref: 'AgentRun', index: true },
  inputPayload: { type: Schema.Types.Mixed, default: {} },
  outputPayload: { type: Schema.Types.Mixed },
  startedAt: { type: Date },
  completedAt: { type: Date },
  errorMessage: { type: String },
  tokensUsed: { type: Number }
}, { timestamps: true });

export const AgentRunModel = mongoose.models.AgentRun || mongoose.model<IAgentRun>('AgentRun', AgentRunSchema);
