import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInterview extends Document {
  application: Types.ObjectId;
  scheduledBy: Types.ObjectId;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  interviewType?: string;
  scheduledAt: Date;
  durationMinutes: number;
  locationOrLink?: string;
  aiSuggestedQuestions: any[];
  feedback?: string;
  rating?: number;
  panelMembers: Types.ObjectId[];
  calendarEventId?: string;
}

const InterviewSchema = new Schema<IInterview>({
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  scheduledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
  interviewType: { type: String },
  scheduledAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, default: 60 },
  locationOrLink: { type: String },
  aiSuggestedQuestions: { type: [Schema.Types.Mixed] as any,
    default: [], },
  feedback: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  panelMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  calendarEventId: { type: String }
}, { timestamps: true });

export const InterviewModel = mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);
