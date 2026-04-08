import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScreeningSnapshot extends Document {
	jobId: Types.ObjectId;
	screeningRun: Types.ObjectId;
	results: any;
}

const ScreeningSnapshotSchema = new Schema<IScreeningSnapshot>({
	jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, unique: true, index: true },
	screeningRun: { type: Schema.Types.ObjectId, ref: 'ScreeningRun', required: true },
	results: { type: Schema.Types.Mixed, default: [] }
}, { timestamps: true });

export const ScreeningSnapshotModel =
	mongoose.models.ScreeningSnapshot || mongoose.model<IScreeningSnapshot>('ScreeningSnapshot', ScreeningSnapshotSchema);

