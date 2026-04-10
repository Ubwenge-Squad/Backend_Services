import { WeightConfigSchema } from './types';

export interface PromptBuildParams {
	job: any;
	applicants: any[];
	weightConfig?: { skills: number; experience: number; education: number; relevance: number };
	topK?: number;
}

export function buildMultiCandidatePrompt(params: PromptBuildParams): string {
	const weight = WeightConfigSchema.parse(params.weightConfig ?? {
		skills: 0.4,
		experience: 0.3,
		education: 0.2,
		relevance: 0.1
	});
	const sys = [
		'You are an expert HR AI assisting recruiters. Evaluate candidates against the job.',
		'Each candidate already has normalized fields {name, skills, experience, education, projects}.',
		'You MUST score and rank all candidates relative to each other in one pass, not independently.',
		'Reasons must be clear and recruiter-friendly: mention role relevance, strongest evidence, and major risk/gap.',
		'Recommendations should be explicit: "Shortlist", "Consider", or "Not selected".',
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

export function buildRecruiterQaPrompt(params: {
	job: unknown;
	results: unknown;
	candidates: unknown;
	question: string;
}): string {
	return [
		'You are an AI recruiter assistant. Answer in plain, recruiter-friendly language.',
		'Use ONLY the provided screening context. If unsure, say what is missing.',
		'Keep answer concise, actionable, and fair.',
		'Job:',
		JSON.stringify(params.job),
		'Screening results:',
		JSON.stringify(params.results),
		'Normalized candidates:',
		JSON.stringify(params.candidates),
		`Recruiter question: ${params.question}`
	].join('\n');
}
