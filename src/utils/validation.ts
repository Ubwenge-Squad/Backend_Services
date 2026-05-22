import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6, 'Password must be at least 6 characters'),
	fullName: z.string().min(1, 'fullName is required'),
	phoneNumber: z.string().min(1, 'phoneNumber is required'),
	role: z.enum(['applicant', 'recruiter', 'admin']).optional().default('recruiter'),
	companyName: z.string().optional(),
}).refine(
	(data) => data.role !== 'recruiter' || data.companyName,
	{ message: 'companyName is required for recruiter accounts', path: ['companyName'] }
);

export const verifyRegistrationSchema = z.object({
	email: z.string().email(),
	code: z.string().min(1, 'code is required'),
});

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1, 'password is required'),
});

export const verifyLoginSchema = z.object({
	email: z.string().email(),
	code: z.string().min(1, 'code is required'),
});

export const resendOtpSchema = z.object({
	email: z.string().email(),
	purpose: z.enum(['register', 'login_otp', 'reset_password']),
});

export const googleSignInSchema = z.object({
	credential: z.string().min(1, 'Google credential is required'),
});

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobIdParam = z.object({ jobId: objectId });

export const createJobSchema = z.object({
	title: z.string().min(1, 'title is required'),
	description: z.string().min(1, 'description is required'),
	requiredSkills: z.array(z.string()).optional().default([]),
	niceToHaveSkills: z.array(z.string()).optional(),
	minYearsExperience: z.number().min(0).optional(),
	requiresDegree: z.boolean().optional(),
	degreeDetails: z.string().optional(),
	location: z.string().optional(),
	isRemote: z.boolean().optional(),
	employmentType: z.string().optional(),
	salaryMin: z.number().min(0).optional(),
	salaryMax: z.number().min(0).optional(),
	currency: z.string().optional(),
	requirements: z.string().optional(),
	responsibilities: z.string().optional(),
	aiAssisted: z.boolean().optional(),
	teamTraits: z.array(z.string()).optional(),
});

export const updateJobSchema = createJobSchema.partial();

// ── Screening ─────────────────────────────────────────────────────────────────
const screeningJobId = z.object({ jobId: objectId });

export const runScreeningSchema = z.object({
	jobId: objectId,
	topK: z.number().int().positive().optional(),
	useCache: z.boolean().optional(),
	weightConfig: z.record(z.string(), z.unknown()).optional(),
});

export const legacyRunScreeningSchema = z.object({
	jobId: objectId,
	batchSize: z.number().int().positive().optional(),
	topK: z.number().int().positive().optional(),
	useCache: z.boolean().optional(),
	weightConfig: z.record(z.string(), z.unknown()).optional(),
});

export const askScreeningSchema = z.object({
	jobId: objectId.optional(),
	question: z.string().min(1, 'question is required'),
});

export const decisionSchema = z.object({
	jobId: objectId,
	applicationId: z.string().min(1, 'applicationId is required'),
	decision: z.enum(['approved', 'rejected', 'pending']),
	note: z.string().optional(),
});

export const finalizeSchema = z.object({
	jobId: objectId,
});

export const screeningResultsQuery = z.object({
	jobId: objectId,
	top: z.coerce.number().int().positive().optional(),
});

export const candidatesQuery = z.object({
	jobId: objectId,
});

export const screeningRunIdParam = z.object({
	screeningRunId: objectId,
});

export const snapshotJobIdParam = z.object({
	jobId: objectId,
});

// ── Sessions ──────────────────────────────────────────────────────────────────
export const createSessionSchema = z.object({
	jobId: objectId,
});

export const thumbsSchema = z.object({
	candidateId: z.string().min(1, 'candidateId is required'),
	signal: z.enum(['up', 'down', 'clear']),
});

export const messageSchema = z.object({
	content: z.string().min(1, 'content is required'),
});

export const confirmSessionSchema = z.object({
	finalDecisions: z.array(z.object({
		candidateId: z.string(),
		decision: z.string(),
		justification: z.string().optional(),
	})).optional(),
	summaryMessage: z.string().optional(),
	recruiterName: z.string().optional(),
});

export const sessionIdParam = z.object({
	id: objectId,
});

// ── Applicants ────────────────────────────────────────────────────────────────
export const createApplicantSchema = z.object({
	user: objectId.optional(),
}).passthrough();

export const applicantIdParam = z.object({
	applicantId: objectId,
});

// ── Applications ──────────────────────────────────────────────────────────────
export const createApplicationSchema = z.object({
	job: objectId,
	applicant: objectId.optional(),
	resume: objectId.optional(),
	coverLetter: z.string().optional(),
});

export const updateApplicationSchema = z.object({
	status: z.enum(['submitted', 'screening', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn']).optional(),
	recruiterNotes: z.string().optional(),
	firstResponseMinutes: z.number().min(0).optional(),
	coverLetter: z.string().optional(),
	resume: objectId.optional(),
});

export const applicationIdParam = z.object({
	applicationId: objectId,
});

// ── Bias ──────────────────────────────────────────────────────────────────────
export const biasAuditIdParam = z.object({
	biasAuditId: objectId,
});

// ── Ingestion ─────────────────────────────────────────────────────────────────
export const ingestUmuravaSchema = z.object({
	fileUrl: z.string().url().optional(),
	data: z.array(z.record(z.string(), z.unknown())).optional(),
}).refine(
	(data) => data.fileUrl || data.data,
	{ message: 'Either fileUrl or data is required', path: ['fileUrl'] }
);

// ── Subscription ──────────────────────────────────────────────────────────────
export const subscribeSchema = z.object({
	planCode: z.enum(['free', 'growth', 'enterprise']),
	paymentMethod: z.enum(['mpesa', 'mtn_momo', 'airtel_money', 'card', 'bank_transfer']).optional(),
	phone: z.string().optional(),
});

// ── Interviews ────────────────────────────────────────────────────────────────
export const scheduleInterviewSchema = z.object({
	applicationId: objectId,
	scheduledAt: z.string().datetime({ message: 'scheduledAt must be an ISO datetime' }),
	durationMinutes: z.number().int().positive().optional(),
	interviewType: z.string().optional(),
	locationOrLink: z.string().optional(),
	panelMembers: z.array(objectId).optional(),
});

export const updateInterviewSchema = z.object({
	status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
	scheduledAt: z.string().datetime().optional(),
	durationMinutes: z.number().int().positive().optional(),
	locationOrLink: z.string().optional(),
	feedback: z.string().optional(),
	rating: z.number().int().min(1).max(5).optional(),
	interviewType: z.string().optional(),
});

export const interviewIdParam = z.object({ interviewId: objectId });

// ── Offers ────────────────────────────────────────────────────────────────────
export const createOfferSchema = z.object({
	applicationId: objectId,
	salary: z.number().min(0),
	currency: z.string().optional(),
	startDate: z.string().datetime().optional(),
	expiryDate: z.string().datetime().optional(),
	notes: z.string().optional(),
});

export const respondOfferSchema = z.object({
	accept: z.boolean(),
	counterOffer: z.number().min(0).optional(),
});

export const offerIdParam = z.object({ offerId: objectId });

// ── Pipeline ──────────────────────────────────────────────────────────────────
export const moveCandidateSchema = z.object({
	applicationId: objectId,
	toStage: z.enum(['submitted', 'screening', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn']),
	note: z.string().optional(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const markReadSchema = z.object({
	ids: z.array(objectId).optional(),
	all: z.boolean().optional(),
});

// ── Webhook (Payment callback) ────────────────────────────────────────────────
export const paymentWebhookSchema = z.object({
	provider: z.enum(['mpesa', 'mtn_momo', 'airtel_money', 'stripe']),
	providerReference: z.string(),
	status: z.enum(['completed', 'failed']),
	amount: z.number().min(0),
	phone: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
