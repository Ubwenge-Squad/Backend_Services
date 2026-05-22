import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  user: Types.ObjectId;
  plan: Types.ObjectId;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  paymentMethod?: 'mpesa' | 'mtn_momo' | 'airtel_money' | 'card' | 'bank_transfer';
  paymentPhone?: string;
  autoRenew: boolean;
  usage: {
    screeningsUsed: number;
    aiChatUsed: number;
  };
}

const SubscriptionSchema = new Schema<ISubscription>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  plan: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  status: { type: String, enum: ['active', 'canceled', 'expired', 'past_due'], default: 'active', index: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  canceledAt: { type: Date },
  paymentMethod: { type: String, enum: ['mpesa', 'mtn_momo', 'airtel_money', 'card', 'bank_transfer'] },
  paymentPhone: { type: String },
  autoRenew: { type: Boolean, default: true },
  usage: {
    screeningsUsed: { type: Number, default: 0 },
    aiChatUsed: { type: Number, default: 0 },
  },
}, { timestamps: true });

export const SubscriptionModel = mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
