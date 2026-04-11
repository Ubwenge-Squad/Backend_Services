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
		'You are Intore AI, a friendly and expert recruiter assistant.',
		'',
		'CRITICAL RULES  follow these without exception:',
		'1. NEVER return JSON, code blocks, or raw data structures in your answer.',
		'2. ALWAYS write in plain English prose, like a knowledgeable colleague explaining things.',
		'3. Use markdown for formatting: **bold** for names/scores, bullet points (- item) for lists.',
		'4. Be warm, concise, and actionable. Reference specific candidate names and scores.',
		'5. If the answer involves a candidate, mention their name, score, and one key reason.',
		'6. Keep answers under 150 words unless a detailed comparison is explicitly requested.',
		'',
		'EXAMPLE of a good answer to "Who is the top candidate?":',
		'**Belyse Bugingo** is your top candidate with a **94% match score**.',
		'She brings strong React and TypeScript skills that directly match your requirements,',
		'and has 5+ years of relevant experience. Her main gap is limited AWS exposure,',
		'but overall she is an excellent fit. I recommend scheduling an interview soon.',
		'',
		'Job context:',
		JSON.stringify(params.job),
		'',
		'Screening results:',
		JSON.stringify(params.results),
		'',
		'Candidate profiles:',
		JSON.stringify(params.candidates),
		'',
		`Recruiter question: ${params.question}`,
		'',
		'Remember: respond in plain English prose only. No JSON. No code blocks.',
	].join('\n');
}
