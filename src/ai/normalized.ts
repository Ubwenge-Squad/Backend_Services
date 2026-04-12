import type { ISkill, IExperience, IEducation, IProject, IAvailability } from '../models/ApplicantProfile.model';

// ── Canonical shape passed to Gemini ─────────────────────────────────────────
export interface NormalizedApplicant {
	name: string;
	headline: string;
	location: string;
	skills: ISkill[];
	experience: IExperience[];
	education: IEducation[];
	projects: IProject[];
	certifications: string[];
	availability: IAvailability;
	totalYearsExperience: number;
}

function asString(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

function splitToSkills(input: unknown): ISkill[] {
	if (Array.isArray(input)) {
		return input.map((x) => {
			if (typeof x === 'object' && x !== null && 'name' in x) {
				return {
					name: asString((x as any).name),
					level: (x as any).level || 'Intermediate',
					yearsOfExperience: Number((x as any).yearsOfExperience ?? 0)
				} as ISkill;
			}
			return { name: asString(x), level: 'Intermediate' as const, yearsOfExperience: 0 };
		}).filter((s) => s.name);
	}
	const str = asString(input);
	if (!str) return [];
	return str.split(/[,;|]/g).map((s) => ({
		name: s.trim(),
		level: 'Intermediate' as const,
		yearsOfExperience: 0
	})).filter((s) => s.name);
}

function computeTotalYears(experience: IExperience[]): number {
	if (!experience.length) return 0;
	let total = 0;
	for (const e of experience) {
		const start = e.startDate ? new Date(e.startDate + '-01') : null;
		const end = e.isCurrent || e.endDate === 'Present' ? new Date() : (e.endDate ? new Date(e.endDate + '-01') : null);
		if (start && end) {
			total += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
		}
	}
	return Math.round(total * 10) / 10;
}

// ── From a full ApplicantProfile document ────────────────────────────────────
export function normalizeApplicantFromProfile(params: {
	firstName?: string | null;
	lastName?: string | null;
	fullName?: string | null;
	headline?: string | null;
	location?: string | null;
	skills?: unknown;
	experience?: IExperience[] | null;
	education?: IEducation[] | null;
	projects?: IProject[] | null;
	certifications?: Array<{ name: string }> | null;
	availability?: IAvailability | null;
	yearsOfExperience?: number | null;
	parsedResumeText?: string | null;
}): NormalizedApplicant {
	const name = asString(params.fullName) ||
		[asString(params.firstName), asString(params.lastName)].filter(Boolean).join(' ') ||
		'Applicant';

	const skills = splitToSkills(params.skills);
	const experience: IExperience[] = Array.isArray(params.experience) ? params.experience : [];
	const education: IEducation[] = Array.isArray(params.education) ? params.education : [];
	const projects: IProject[] = Array.isArray(params.projects) ? params.projects : [];
	const certifications = (params.certifications || []).map((c) => c.name).filter(Boolean);
	const totalYearsExperience = params.yearsOfExperience ?? computeTotalYears(experience);

	return {
		name,
		headline: asString(params.headline) || skills.slice(0, 3).map((s) => s.name).join(', '),
		location: asString(params.location) || 'Not specified',
		skills,
		experience,
		education,
		projects,
		certifications,
		availability: params.availability ?? { status: 'Available', type: 'Full-time' },
		totalYearsExperience
	};
}

// ── From Umurava / external JSON profile ─────────────────────────────────────
export function normalizeApplicantFromExternal(input: {
	name: string;
	firstName?: string;
	lastName?: string;
	headline?: string;
	location?: string;
	skills?: unknown;
	experience?: unknown[];
	education?: unknown[];
	projects?: unknown[];
	certifications?: unknown[];
	availability?: unknown;
}): NormalizedApplicant {
	const skills = splitToSkills(input.skills);

	const experience: IExperience[] = (input.experience || []).map((e: any) => ({
		company: asString(e.company || e.organization),
		role: asString(e.role || e.position || e.title),
		startDate: asString(e.startDate || e.start_date || ''),
		endDate: asString(e.endDate || e.end_date || 'Present'),
		description: asString(e.description || e.summary || ''),
		technologies: Array.isArray(e.technologies) ? e.technologies.map(asString) : splitToSkills(e.technologies).map((s) => s.name),
		isCurrent: Boolean(e.isCurrent || e.is_current || e.endDate === 'Present')
	})).filter((e) => e.company || e.role);

	const education: IEducation[] = (input.education || []).map((e: any) => ({
		institution: asString(e.institution || e.school || e.university),
		degree: asString(e.degree || e.qualification || ''),
		fieldOfStudy: asString(e.fieldOfStudy || e.field || e.major || ''),
		startYear: Number(e.startYear || e.start_year || 0),
		endYear: Number(e.endYear || e.end_year || 0)
	})).filter((e) => e.institution);

	const projects: IProject[] = (input.projects || []).map((p: any) => ({
		name: asString(p.name || p.title),
		description: asString(p.description || ''),
		technologies: Array.isArray(p.technologies) ? p.technologies.map(asString) : [],
		role: asString(p.role || ''),
		link: asString(p.link || p.url || p.github || ''),
		startDate: asString(p.startDate || ''),
		endDate: asString(p.endDate || '')
	})).filter((p) => p.name);

	const certifications = (input.certifications || []).map((c: any) =>
		asString(typeof c === 'string' ? c : c.name)
	).filter(Boolean);

	const avail: any = input.availability || {};
	const availability: IAvailability = {
		status: avail.status || 'Available',
		type: avail.type || 'Full-time',
		startDate: avail.startDate
	};

	return {
		name: input.name || [input.firstName, input.lastName].filter(Boolean).join(' ') || 'Applicant',
		headline: asString(input.headline) || skills.slice(0, 3).map((s) => s.name).join(', '),
		location: asString(input.location) || 'Not specified',
		skills,
		experience,
		education,
		projects,
		certifications,
		availability,
		totalYearsExperience: computeTotalYears(experience)
	};
}
