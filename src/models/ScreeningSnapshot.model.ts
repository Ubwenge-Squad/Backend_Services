import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScreeningSnapshot extends Document {
	jobId: Types.ObjectId;
	screeningRun: Types.ObjectId;
	results: any;
	// Recruiter decisions per candidate (keyed by applicationId)
	decisions: Record<string, {
		decision: 'approved' | 'rejected' | 'pending';
		note?: string;
		decidedAt?: Date;
		decidedBy?: string;
	}>;
	// Finalization
	finalized: boolean;
	finalizedAt?: Date;
	finalizedBy?: string;
	finalSummary?: string;
}

const ScreeningSnapshotSchema = new Schema<IScreeningSnapshot>({
	jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, unique: true, index: true },
	screeningRun: { type: Schema.Types.ObjectId, ref: 'ScreeningRun', required: true },
	results: { type: Schema.Types.Mixed, default: [] },
	decisions: { type: Schema.Types.Mixed, default: {} },
	finalized: { type: Boolean, default: false },
	finalizedAt: { type: Date },
	finalizedBy: { type: String },
	finalSummary: { type: String }
}, { timestamps: true });

export const ScreeningSnapshotModel =
	mongoose.models.ScreeningSnapshot || mongoose.model<IScreeningSnapshot>('ScreeningSnapshot', ScreeningSnapshotSchema);

