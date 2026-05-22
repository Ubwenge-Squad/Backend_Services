import { Router, Request, Response } from 'express';
import { ScreeningOrchestrator } from '../ai/orchestrator';
import { buildRecruiterQaPrompt } from '../ai/prompts';
import { GeminiAiService } from '../ai/gemini';
import { getJobWithApplicants } from '../ai/retrievers/mongoRetriever';
import { ScreeningRunModel } from '../models/ScreeningRun.model';
import { ScreeningResultModel } from '../models/ScreeningResult.model';
import { ScreeningSnapshotModel } from '../models/ScreeningSnapshot.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { JobModel } from '../models/Job.model';
import { requireAuth, requireRole } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/core';
import { validate } from '../middlewares/validate';
import { sendSuccess, sendError } from '../utils/response';
import {
	runScreeningSchema, legacyRunScreeningSchema,
	askScreeningSchema, decisionSchema, finalizeSchema,
	screeningResultsQuery, candidatesQuery,
	screeningRunIdParam, snapshotJobIdParam,
} from '../utils/validation';

const router = Router();

function getApiKey(): string {
	if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
	return process.env.GEMINI_API_KEY!;
}

function makeAi() {
	return new GeminiAiService(getApiKey(), { model: 'gemini-2.5-flash' });
}

// ── Run screening ────────────────────────────────────────────────────────────
router.post('/run', requireAuth, validate({ body: runScreeningSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId, topK, useCache, weightConfig } = req.body || {};
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}
	const orch = new ScreeningOrchestrator(getApiKey());
	const userId = req.user?.id || 'system';
	const out = await orch.runForJob(jobId, userId, { topK, useCache, weightConfig });
	sendSuccess(res, {
		jobId,
		screeningRunId: out.run._id,
		results: out.results
	});
}));

// ── Legacy alias for run ─────────────────────────────────────────────────────
router.post('/runs', requireAuth, validate({ body: legacyRunScreeningSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId, batchSize, topK, useCache, weightConfig } = req.body || {};
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}
	const orch = new ScreeningOrchestrator(getApiKey());
	const userId = req.user?.id || 'system';
	const run = await orch.runForJob(jobId, userId, { topK: topK ?? batchSize, weightConfig, useCache });
	sendSuccess(res, run, 202);
}));

// ── Get screening run ────────────────────────────────────────────────────────
router.get('/runs/:screeningRunId', requireAuth, validate({ params: screeningRunIdParam }), asyncHandler(async (req: Request, res: Response) => {
	const run = await ScreeningRunModel.findById(req.params.screeningRunId).lean();
	if (!run) {
		sendError(res, 404, 'Screening run not found', 'NOT_FOUND');
		return;
	}
	sendSuccess(res, run);
}));

// ── Get screening run results ────────────────────────────────────────────────
router.get('/runs/:screeningRunId/results', requireAuth, validate({ params: screeningRunIdParam }), asyncHandler(async (req: Request, res: Response) => {
	const results = await ScreeningResultModel.find({ screeningRun: req.params.screeningRunId })
		.sort({ rankPosition: 1 })
		.lean();
	sendSuccess(res, results);
}));

// ── Get latest snapshot for a job ────────────────────────────────────────────
router.get('/results', requireAuth, validate({ query: screeningResultsQuery }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId, top } = req.query as Record<string, string>;
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}
	const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
	if (recruiterProfile) {
		const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
		if (!job) {
			sendError(res, 403, 'Access denied', 'FORBIDDEN');
			return;
		}
	}
	const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
	if (!snapshot) {
		sendSuccess(res, []);
		return;
	}
	const limit = Number(top) || 20;
	sendSuccess(res, (snapshot.results || []).slice(0, limit));
}));

// ── Get normalized candidates for a job ──────────────────────────────────────
router.get('/candidates', requireAuth, validate({ query: candidatesQuery }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId } = req.query as Record<string, string>;
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}
	const { applicants } = await getJobWithApplicants(String(jobId));
	sendSuccess(res, applicants.map((a) => ({
		applicationId: a.applicationId,
		...a.normalized
	})));
}));

// ── AI Q&A about screening results ───────────────────────────────────────────
router.post('/ask', requireAuth, validate({ body: askScreeningSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId, question } = req.body || {};
	if (!question) {
		sendError(res, 400, 'question is required', 'BAD_REQUEST');
		return;
	}
	const ai = makeAi();
	const recruiterId = req.user!.id;

	const recruiterProfile = await RecruiterProfileModel.findOne({ user: recruiterId }).lean();
	const myJobIds = recruiterProfile
		? (await JobModel.find({ recruiter: recruiterProfile._id }).select('_id').lean()).map((j: any) => String(j._id))
		: [];

	if (!jobId || jobId === 'general') {
		const latestSnapshot = myJobIds.length
			? await ScreeningSnapshotModel.findOne({ jobId: { $in: myJobIds } }).sort({ updatedAt: -1 }).lean()
			: null;

		if (!latestSnapshot) {
			const generalPrompt = [
				'You are Intore AI, an expert recruiter assistant for Rwanda-based recruiting.',
				'No screening data is available yet for this recruiter. Answer helpfully and suggest next steps.',
				`Question: ${String(question)}`
			].join('\n');
			const answer = await ai.answerWithPrompt(generalPrompt);
			sendSuccess(res, { answer });
			return;
		}
		const { job, applicants } = await getJobWithApplicants(String(latestSnapshot.jobId));
		const prompt = buildRecruiterQaPrompt({
			job,
			results: latestSnapshot.results || [],
			candidates: applicants.map((a) => a.normalized),
			question: String(question)
		});
		const answer = await ai.answerWithPrompt(prompt);
		sendSuccess(res, { answer });
		return;
	}

	if (!myJobIds.includes(String(jobId))) {
		sendError(res, 403, 'You do not have access to this job', 'FORBIDDEN');
		return;
	}

	const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
	if (!snapshot) {
		sendError(res, 400, 'No screening results found for this job yet. Run screening first.', 'BAD_REQUEST');
		return;
	}
	const { job, applicants } = await getJobWithApplicants(String(jobId));
	const prompt = buildRecruiterQaPrompt({
		job,
		results: snapshot.results || [],
		candidates: applicants.map((a) => a.normalized),
		question: String(question)
	});
	const answer = await ai.answerWithPrompt(prompt);
	sendSuccess(res, { answer });
}));

// ── Save thumbs up/down decision ─────────────────────────────────────────────
router.patch('/decision', requireAuth, validate({ body: decisionSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId, applicationId, decision, note } = req.body || {};
	if (!jobId || !applicationId || !decision) {
		sendError(res, 400, 'jobId, applicationId, decision are required', 'BAD_REQUEST');
		return;
	}
	if (!['approved', 'rejected', 'pending'].includes(decision)) {
		sendError(res, 400, 'decision must be approved, rejected, or pending', 'BAD_REQUEST');
		return;
	}
	const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
	if (recruiterProfile) {
		const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
		if (!job) {
			sendError(res, 403, 'Access denied', 'FORBIDDEN');
			return;
		}
	}
	const update: Record<string, any> = {
		[`decisions.${applicationId}.decision`]: decision,
		[`decisions.${applicationId}.decidedAt`]: new Date(),
		[`decisions.${applicationId}.decidedBy`]: req.user!.id,
	};
	if (note !== undefined) update[`decisions.${applicationId}.note`] = note;
	const snapshot = await ScreeningSnapshotModel.findOneAndUpdate(
		{ jobId },
		{ $set: update },
		{ new: true }
	).lean();
	if (!snapshot) {
		sendError(res, 404, 'No screening found for this job', 'NOT_FOUND');
		return;
	}

	let aiComment = '';
	if (getApiKey()) {
		const ai = makeAi();
		const candidate = (snapshot.results as any[]).find((r: any) => r.applicationId === applicationId);
		const prompt = [
			'You are Intore AI, a friendly recruiter assistant.',
			`The recruiter just marked candidate "${candidate?.name || applicationId}" as "${decision}".`,
			`Their AI score was ${candidate?.score ?? '?'}% with recommendation: ${candidate?.recommendation ?? '?'}.`,
			decision === 'approved'
				? 'Briefly affirm this choice in 1-2 sentences, mentioning one key strength.'
				: decision === 'rejected'
					? 'Briefly acknowledge this in 1-2 sentences, mentioning the key gap that likely drove the decision.'
					: 'Acknowledge the pending status in 1 sentence.',
			'Be warm, concise, no JSON.'
		].join('\n');
		aiComment = await ai.answerWithPrompt(prompt).catch(() => '');
	}
	sendSuccess(res, { ok: true, aiComment });
}));

// ── Finalize screening ───────────────────────────────────────────────────────
router.post('/finalize', requireAuth, validate({ body: finalizeSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId } = req.body || {};
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}
	const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
	if (recruiterProfile) {
		const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
		if (!job) {
			sendError(res, 403, 'Access denied', 'FORBIDDEN');
			return;
		}
	}
	const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
	if (!snapshot) {
		sendError(res, 404, 'No screening found', 'NOT_FOUND');
		return;
	}

	const results = (snapshot.results as any[]) || [];
	const decisions = (snapshot.decisions as Record<string, any>) || {};
	const approved = results.filter((r: any) => decisions[r.applicationId]?.decision === 'approved');
	const rejected = results.filter((r: any) => decisions[r.applicationId]?.decision === 'rejected');
	const pending = results.filter((r: any) => !decisions[r.applicationId] || decisions[r.applicationId]?.decision === 'pending');

	let finalSummary = `Screening finalized. ${approved.length} approved, ${rejected.length} rejected, ${pending.length} pending.`;

	if (getApiKey()) {
		const ai = makeAi();
		const prompt = [
			'You are Intore AI. Generate a concise final screening report in plain English (no JSON).',
			'Use markdown: **bold** for names, bullet points for lists.',
			`Total candidates screened: ${results.length}`,
			`Approved (${approved.length}): ${approved.map((r: any) => `${r.name} (${r.score}%)`).join(', ') || 'none'}`,
			`Rejected (${rejected.length}): ${rejected.map((r: any) => r.name).join(', ') || 'none'}`,
			`Pending (${pending.length}): ${pending.map((r: any) => r.name).join(', ') || 'none'}`,
			'Write 3-4 sentences: who was approved and why they stand out, key gaps in rejected candidates, and a next-step recommendation.',
		].join('\n');
		finalSummary = await ai.answerWithPrompt(prompt).catch(() => finalSummary);
	}

	await ScreeningSnapshotModel.findOneAndUpdate(
		{ jobId },
		{ $set: { finalized: true, finalizedAt: new Date(), finalizedBy: req.user!.id, finalSummary } }
	);
	sendSuccess(res, { ok: true, finalSummary, approved: approved.length, rejected: rejected.length, pending: pending.length });
}));

// ── Get snapshot for a job ────────────────────────────────────────────────────
router.get('/snapshot/:jobId', requireAuth, validate({ params: snapshotJobIdParam }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId } = req.params;
	const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
	if (recruiterProfile) {
		const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
		if (!job) {
			sendError(res, 403, 'Access denied', 'FORBIDDEN');
			return;
		}
	}
	const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
	sendSuccess(res, snapshot || null);
}));

export default router;
