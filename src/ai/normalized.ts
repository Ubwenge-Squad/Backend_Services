import { z } from 'zod';

export const NormalizedApplicantSchema = z.object({
	name: z.string().min(1),
	skills: z.array(z.string()).default([]),
	experience: z.number().min(0).default(0),
	education: z.string().default('Not specified'),
	projects: z.array(z.string()).default([])
});

export type NormalizedApplicant = z.infer<typeof NormalizedApplicantSchema>;

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function splitSkills(input: unknown): string[] {
	if (Array.isArray(input)) return input.map((x) => asString(x)).filter(Boolean);
	const str = asString(input);
	if (!str) return [];
	return str.split(/[,;|]/g).map((s) => s.trim()).filter(Boolean);
}

export function normalizeApplicantFromProfile(params: {
	fullName?: string | null;
	skills?: unknown;
	yearsOfExperience?: number | null;
	education?: Array<{ institution?: string; degree?: string; fieldOfStudy?: string }> | null;
	workExperience?: Array<{ description?: string; position?: string; company?: string }> | null;
	parsedResumeText?: string | null;
}): NormalizedApplicant {
	const educationEntries = (params.education || []).map((e) =>
		[e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(' - ').trim()
	).filter(Boolean);
	const education = educationEntries[0] || 'Not specified';

	const projectsFromWork = (params.workExperience || [])
		.map((w) => [w.position, w.company, w.description].filter(Boolean).join(' @ ').trim())
		.filter(Boolean);

	const projects = projectsFromWork.length
		? projectsFromWork
		: (params.parsedResumeText ? [params.parsedResumeText.slice(0, 200)] : []);

	return NormalizedApplicantSchema.parse({
		name: asString(params.fullName) || 'Applicant',
		skills: splitSkills(params.skills),
		experience: typeof params.yearsOfExperience === 'number' && !Number.isNaN(params.yearsOfExperience) ? params.yearsOfExperience : 0,
		education,
		projects
	});
}

export function normalizeApplicantFromExternal(input: {
	name: string;
	skills?: string[];
	experience?: number;
	education?: string;
	projects?: string[];
}): NormalizedApplicant {
	return NormalizedApplicantSchema.parse({
		name: input.name,
		skills: input.skills || [],
		experience: input.experience ?? 0,
		education: input.education || 'Not specified',
		projects: input.projects || []
	});
}

