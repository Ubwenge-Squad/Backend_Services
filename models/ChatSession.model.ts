import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestionChips: string[];
  isComplete: boolean;
  tokensUsed?: number;
  createdAt: Date;
}

export interface IChatSession extends Document {
  screeningRun: Types.ObjectId;
  recruiter: Types.ObjectId;
  unlockedAt?: Date;
  messages: IChatMessage[];
}

const ChatMessageSchema = new Schema<IChatMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  suggestionChips: { type: [String], default: [] },
  isComplete: { type: Boolean, default: true },
  tokensUsed: { type: Number },
  createdAt: { type: Date, default: Date.now }
}, { _id: true }); // keep _id for subdocuments just in case

const ChatSessionSchema = new Schema<IChatSession>({
  screeningRun: { type: Schema.Types.ObjectId, ref: 'ScreeningRun', required: true, index: true },
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  unlockedAt: { type: Date },
  messages: { type: [ChatMessageSchema], default: [] }
}, { timestamps: true });

export const ChatSessionModel = mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
