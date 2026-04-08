import { z } from 'zod';

export const ScoreBreakdownSchema = z.object({
	skills: z.number().min(0).max(100),
	experience: z.number().min(0).max(100),
	education: z.number().min(0).max(100),
	relevance: z.number().min(0).max(100)
});

export const WeightConfigSchema = z.object({
	skills: z.number().min(0).max(1),
	experience: z.number().min(0).max(1),
	education: z.number().min(0).max(1),
	relevance: z.number().min(0).max(1)
}).refine((w) => Math.abs(w.skills + w.experience + w.education + w.relevance - 1) < 1e-6, {
	message: 'Weights must sum to 1'
});

export const CandidateEvaluationSchema = z.object({
	applicationId: z.string(),
	name: z.string().optional(),
	fitScore: z.number().min(0).max(100),
	rankPosition: z.number().int().optional(),
	confidenceLevel: z.enum(['high', 'medium', 'low']),
	aiReasoning: z.string().min(1),
	strengths: z.array(z.string()).default([]),
	gaps: z.array(z.string()).default([]),
	scoreBreakdown: ScoreBreakdownSchema,
	weightConfig: WeightConfigSchema,
	predictedJoinProbability: z.number().min(0).max(1).optional(),
	counterOfferRisk: z.number().min(0).max(1).optional(),
	adjacentRoles: z.array(z.string()).default([]),
	upskillingPaths: z.array(z.record(z.string(),z.any())).default([])
});

export const ModelOutputSchema = z.object({
	results: z.array(CandidateEvaluationSchema)
});

// Strict shortlist shape exposed to UI/API for final ranking output.
export const RankedOutputItemSchema = z.object({
	rank: z.number().int().positive(),
	name: z.string().min(1),
	score: z.number().min(0).max(100),
	strengths: z.array(z.string()),
	gaps: z.array(z.string()),
	reason: z.string().min(1),
	recommendation: z.string().min(1),
	applicationId: z.string().optional()
});

export const RankedOutputSchema = z.array(RankedOutputItemSchema);

export type CandidateEvaluation = z.infer<typeof CandidateEvaluationSchema>;
export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type RankedOutputItem = z.infer<typeof RankedOutputItemSchema>;

