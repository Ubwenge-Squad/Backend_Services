import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IOffer extends Document {
  application: Types.ObjectId;
  issuedBy: Types.ObjectId;
  salary: number;
  currency: string;
  startDate?: Date;
  expiryDate?: Date;
  offerLetterUrl?: string;
  isAccepted?: boolean;
  respondedAt?: Date;
  counterOffered: boolean;
  notes?: string;
}

const OfferSchema = new Schema<IOffer>({
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  salary: { type: Number, required: true },
  currency: { type: String, default: 'RWF' },
  startDate: { type: Date },
  expiryDate: { type: Date },
  offerLetterUrl: { type: String },
  isAccepted: { type: Boolean },
  respondedAt: { type: Date },
  counterOffered: { type: Boolean, default: false },
  notes: { type: String }
}, { timestamps: true });

export const OfferModel = mongoose.models.Offer || mongoose.model<IOffer>('Offer', OfferSchema);
