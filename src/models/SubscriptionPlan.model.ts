import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  code: 'free' | 'growth' | 'enterprise';
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: Record<string, boolean | number>;
  quotas: {
    screeningsPerMonth: number;
    activeJobs: number;
    candidatesPerJob: number;
    aiChatPerDay: number;
    teamMembers: number;
    whatsAppAccess: boolean;
    umuravaSync: boolean;
    biasReports: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
  isActive: boolean;
  sortOrder: number;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>({
  name: { type: String, required: true },
  code: { type: String, enum: ['free', 'growth', 'enterprise'], required: true, unique: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  interval: { type: String, enum: ['month', 'year'], default: 'month' },
  features: { type: Schema.Types.Mixed, default: {} },
  quotas: {
    screeningsPerMonth: { type: Number, default: 10 },
    activeJobs: { type: Number, default: 1 },
    candidatesPerJob: { type: Number, default: 20 },
    aiChatPerDay: { type: Number, default: 5 },
    teamMembers: { type: Number, default: 1 },
    whatsAppAccess: { type: Boolean, default: false },
    umuravaSync: { type: Boolean, default: false },
    biasReports: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const SubscriptionPlanModel = mongoose.models.SubscriptionPlan || mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
