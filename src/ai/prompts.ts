import { WeightConfigSchema } from './types';

export interface PromptBuildParams {
	job: any;
	applicants: any[];
	weightConfig?: { skills: number; experience: number; education: number; relevance: number };
	topK?: number;
}

export function buildMultiCandidatePrompt(params: PromptBuildParams): string {
	const weight = WeightConfigSchema.partial().parse(params.weightConfig ?? { skills: 0.4, experience: 0.3, education: 0.1, relevance: 0.2 });
	const sys = [
		'You are an expert HR AI assisting recruiters. Evaluate candidates against the job,',
		'produce JSON with fields: applicationId, fitScore(0-100), confidenceLevel, aiReasoning, strengths[], gaps[],',
		'scoreBreakdown{skills,experience,education,relevance}, weightConfig, predictedJoinProbability(0-1), counterOfferRisk(0-1), adjacentRoles[], upskillingPaths[].',
		'Return strictly valid JSON: {"results":[...]} with no markdown or prose.'
	].join(' ');
	return [
		sys,
		'Job:',
		JSON.stringify(params.job),
		'Candidates:',
		JSON.stringify(params.applicants),
		'Weights:',
		JSON.stringify(weight),
		`TopK: ${params.topK ?? 20}`
	].join('\n');
}

