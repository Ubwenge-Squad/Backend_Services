import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuthSession extends Document {
  user: Types.ObjectId;
  tokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  deviceInfo: { type: String },
  ipAddress: { type: String },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date }
}, { timestamps: true });

// Set default expiration to 7 days from creation
AuthSessionSchema.pre('validate', function(next) {
  if (!this.expiresAt) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    this.expiresAt = expires;
  }
  (next as any)();
});

export const AuthSessionModel = mongoose.models.AuthSession || mongoose.model<IAuthSession>('AuthSession', AuthSessionSchema);
