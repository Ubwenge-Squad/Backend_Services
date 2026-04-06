import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  user: Types.ObjectId;
  type: string; // 'screening_complete', 'interview_scheduled', 'offer_received', etc.
  title: string;
  body: string;
  isRead: boolean;
  actionUrl?: string;
  metadata?: any;
}

const NotificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  actionUrl: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Compound index to quickly find unread notifications per user
NotificationSchema.index({ user: 1, isRead: 1 });

export const NotificationModel = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
