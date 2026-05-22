import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  user: Types.ObjectId;
  subscription?: Types.ObjectId;
  amount: number;
  currency: string;
  method: 'mpesa' | 'mtn_momo' | 'airtel_money' | 'card' | 'bank_transfer';
  phone?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  providerReference?: string;
  providerResponse?: any;
  description: string;
  paidAt?: Date;
}

const PaymentSchema = new Schema<IPayment>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  method: { type: String, enum: ['mpesa', 'mtn_momo', 'airtel_money', 'card', 'bank_transfer'], required: true },
  phone: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending', index: true },
  providerReference: { type: String },
  providerResponse: { type: Schema.Types.Mixed },
  description: { type: String, required: true },
  paidAt: { type: Date },
}, { timestamps: true });

PaymentSchema.index({ user: 1, status: 1 });

export const PaymentModel = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
