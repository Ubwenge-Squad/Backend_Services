import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationToken extends Document {
  email: string;
  code: string;
  purpose: 'register' | 'reset_password' | 'login_otp';
  expiresAt: Date;
  usedAt?: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>({
  email: { type: String, required: true, index: true },
  code: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['register', 'reset_password', 'login_otp'], required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date }
}, { timestamps: true });

VerificationTokenSchema.index({ email: 1, purpose: 1, code: 1 }, { unique: true });

export const VerificationTokenModel = mongoose.models.VerificationToken || mongoose.model<IVerificationToken>('VerificationToken', VerificationTokenSchema);

