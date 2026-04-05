import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISemanticCache extends Document {
  queryHash: string; // SHA-256 of normalized query
  queryEmbedding?: number[]; // Representing vector(1536) for similarity matching
  queryText: string;
  responseText: string;
  modelVersion: string;
  hitCount: number;
  tokensSaved: number;
  expiresAt: Date;
}

const SemanticCacheSchema = new Schema<ISemanticCache>({
  queryHash: { type: String, required: true, unique: true, index: true },
  queryEmbedding: { type: [Number] },
  queryText: { type: String, required: true },
  responseText: { type: String, required: true },
  modelVersion: { type: String, required: true },
  hitCount: { type: Number, default: 0 },
  tokensSaved: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });

// Set default expiration to 24 hours from creation
SemanticCacheSchema.pre('validate', function(next) {
  if (!this.expiresAt) {
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    this.expiresAt = expires;
  }
  next();
});

export const SemanticCacheModel = mongoose.models.SemanticCache || mongoose.model<ISemanticCache>('SemanticCache', SemanticCacheSchema);
