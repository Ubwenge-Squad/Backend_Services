import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBiasSimulation extends Document {
  recruiter: Types.ObjectId;
  job?: Types.ObjectId;
  simulationName: string;
  filtersApplied: any;
  diversityImpact?: any;
  skillDelta?: any;
}

const BiasSimulationSchema = new Schema<IBiasSimulation>({
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job' },
  simulationName: { type: String, required: true },
  filtersApplied: { type: Schema.Types.Mixed, default: {} },
  diversityImpact: { type: Schema.Types.Mixed },
  skillDelta: { type: Schema.Types.Mixed }
}, { timestamps: true });

export const BiasSimulationModel = mongoose.models.BiasSimulation || mongoose.model<IBiasSimulation>('BiasSimulation', BiasSimulationSchema);
