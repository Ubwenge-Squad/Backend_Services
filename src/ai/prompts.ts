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
		'Each candidate already has normalized fields {name, skills, experience, education, projects}.',
		'You MUST score and rank all candidates relative to each other in one pass.',
		'Return STRICT JSON only (no markdown):',
		'[{"rank":1,"name":"...","score":0-100,"strengths":[],"gaps":[],"reason":"...","recommendation":"...","applicationId":"..."}]',
		'No extra keys, no prose.'
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

