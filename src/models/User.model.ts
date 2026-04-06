import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;    
  passwordHash: string;
  role: 'applicant' | 'recruiter' | 'admin';
  fullName: string;
  avatarUrl?: string;
  phoneNumber?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  deletedAt?: Date;
  scheduledPurgeAt?: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['applicant', 'recruiter', 'admin'], default: 'applicant', index: true },
  fullName: { type: String, required: true },
  avatarUrl: { type: String },
  phoneNumber: { type: String },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  deletedAt: { type: Date, index: true },
  scheduledPurgeAt: { type: Date }
}, {
  timestamps: true
});

// Middleware for GDPR scheduled purge calculation
UserSchema.pre('save', function (next) {
  if (this.isModified('deletedAt') && this.deletedAt && !this.scheduledPurgeAt) {
    const purgeDate = new Date(this.deletedAt.getTime());
    purgeDate.setDate(purgeDate.getDate() + 90);
    this.scheduledPurgeAt = purgeDate;
  }

});

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
