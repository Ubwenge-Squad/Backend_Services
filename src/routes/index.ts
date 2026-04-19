import { Express, Request, Response } from 'express';
import multer from 'multer';
import { ScreeningOrchestrator } from '../ai/orchestrator';
import { ScreeningRunModel } from '../models/ScreeningRun.model';
import { ScreeningResultModel } from '../models/ScreeningResult.model';
import { ScreeningSnapshotModel } from '../models/ScreeningSnapshot.model';
import { AuthController } from '../Controllers/auth.controller';
import { ApplicantsController } from '../Controllers/applicants.controller';
import { ApplicationsController } from '../Controllers/applications.controller';
import { BiasController } from '../Controllers/bias.controller';
import { IngestionController } from '../Controllers/ingestion.controller';
import { JobsController } from '../Controllers/jobs.controller';
import { ResumesController } from '../Controllers/resumes.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { getJobWithApplicants } from '../ai/retrievers/mongoRetriever';
import { buildRecruiterQaPrompt } from '../ai/prompts';
import { GeminiAiService } from '../ai/gemini';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { JobModel } from '../models/Job.model';
import { DecisionSessionModel } from '../models/DecisionSession.model';
import sessionRoutes from './sessions';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app: Express): void {
	// Auth
	app.post('/auth/register', AuthController.register);
	app.post('/auth/verify-registration', AuthController.verifyRegistration);
	app.post('/auth/login', AuthController.login);
	app.post('/auth/verify-login', AuthController.verifyLogin);
	app.post('/auth/resend-otp', AuthController.resendOtp);
	app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
		res.json({ user: req.user });
	});
	app.post('/auth/logout', (_req: Request, res: Response) => res.status(204).send());

	// Jobs
	app.get('/jobs', requireAuth, requireRole(['recruiter', 'admin']), JobsController.list);
	app.post('/jobs', requireAuth, requireRole(['recruiter', 'admin']), JobsController.create);
	app.get('/jobs/:jobId', requireAuth, requireRole(['recruiter', 'admin']), JobsController.getById);
	app.patch('/jobs/:jobId', requireAuth, requireRole(['recruiter', 'admin']), JobsController.update);
	app.post('/jobs/:jobId/activate', requireAuth, requireRole(['recruiter', 'admin']), JobsController.activate);
	app.post('/jobs/:jobId/close', requireAuth, requireRole(['recruiter', 'admin']), JobsController.close);

	// Applicants
	app.get('/applicants', requireAuth, requireRole(['recruiter', 'admin']), ApplicantsController.list);
	app.post('/applicants', requireAuth, ApplicantsController.create);
	app.get('/applicants/:applicantId', requireAuth, ApplicantsController.getById);
	app.patch('/applicants/:applicantId', requireAuth, ApplicantsController.update);

	// Resumes
	app.post('/resumes', requireAuth, upload.single('file'), ResumesController.create);
	app.get('/resumes/:resumeId', requireAuth, ResumesController.getById);
	app.post('/resumes/:resumeId/parse', requireAuth, requireRole(['recruiter', 'admin']), ResumesController.parse);

	// Applications
	app.get('/applications', requireAuth, ApplicationsController.list);
	app.post('/applications', requireAuth, ApplicationsController.create);
	app.patch('/applications/:applicationId', requireAuth, ApplicationsController.update);

	// Legacy Screening
	app.post('/screening/run', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId, topK, useCache, weightConfig } = req.body || {};
			if (!jobId) {
				res.status(400).json({ message: 'jobId is required' });
				return;
			}
			if (!process.env.GEMINI_API_KEY) {
				res.status(500).json({ message: 'GEMINI_API_KEY not configured' });
				return;
			}
			const orch = new ScreeningOrchestrator(process.env.GEMINI_API_KEY!);
			const userId = req.user?.id || 'system';
			const out = await orch.runForJob(jobId, userId, { topK, useCache, weightConfig });
			res.status(200).json({
				jobId,
				screeningRunId: out.run._id,
				results: out.results
			});
		} catch (err: any) {
			console.error('[/screening/run] error:', err);
			res.status(500).json({ message: err?.message ?? 'Failed to run screening' });
		}
	});

	app.post('/screening-runs', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId, batchSize, topK, useCache, weightConfig } = req.body || {};
			if (!jobId) {
				res.status(400).json({ message: 'jobId is required' });
				return;
			}
			if (!process.env.GEMINI_API_KEY) {
				res.status(500).json({ message: 'GEMINI_API_KEY not configured' });
				return;
			}
			const orch = new ScreeningOrchestrator(process.env.GEMINI_API_KEY!);
			const userId = req.user?.id || 'system';
			const run = await orch.runForJob(jobId, userId, { topK: topK ?? batchSize, weightConfig, useCache });
			res.status(202).json(run);
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to start screening' });
		}
	});
	app.get('/screening-runs/:screeningRunId', requireAuth, async (req: Request, res: Response) => {
		const run = await ScreeningRunModel.findById(req.params.screeningRunId).lean();
		if (!run) {
			res.status(404).json({ message: 'Not found' });
			return;
		}
		res.json(run);
	});
	app.get('/screening-runs/:screeningRunId/results', requireAuth, async (req: Request, res: Response) => {
		const results = await ScreeningResultModel.find({ screeningRun: req.params.screeningRunId }).sort({ rankPosition: 1 }).lean();
		res.json(results);
	});
	app.get('/screening-results', requireAuth, async (req: Request, res: Response) => {
		const { jobId, top } = req.query as any;
		if (!jobId) {
			res.status(400).json({ message: 'jobId is required' });
			return;
		}
		// Verify the job belongs to this recruiter
		const recruiterProfile2 = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
		if (recruiterProfile2) {
			const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile2._id }).lean();
			if (!job) {
				res.status(403).json({ message: 'Access denied.' });
				return;
			}
		}
		const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
		if (!snapshot) {
			res.json([]);
			return;
		}
		const limit = Number(top) || 20;
		res.json((snapshot.results || []).slice(0, limit));
	});
	app.get('/screening/candidates', requireAuth, async (req: Request, res: Response) => {
		const { jobId } = req.query as any;
		if (!jobId) {
			res.status(400).json({ message: 'jobId is required' });
			return;
		}
		const { applicants } = await getJobWithApplicants(String(jobId));
		res.json(
			applicants.map((a) => ({
				applicationId: a.applicationId,
				...a.normalized
			}))
		);
	});
	app.post('/screening/ask', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId, question } = req.body || {};
			if (!question) {
				res.status(400).json({ message: 'question is required' });
				return;
			}
			if (!process.env.GEMINI_API_KEY) {
				res.status(500).json({ message: 'GEMINI_API_KEY not configured' });
				return;
			}
			const ai = new GeminiAiService(process.env.GEMINI_API_KEY, { model: 'gemini-2.5-flash' });
			const recruiterId = req.user!.id;

			// Resolve the recruiter's own job IDs for scoping
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: recruiterId }).lean();
			const myJobIds = recruiterProfile
				? (await JobModel.find({ recruiter: recruiterProfile._id }).select('_id').lean()).map((j: any) => String(j._id))
				: [];

			// General context: no specific job or jobId === 'general'
			if (!jobId || jobId === 'general') {
				// Only look at snapshots for THIS recruiter's jobs
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
					res.json({ answer });
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
				res.json({ answer });
				return;
			}

			// Job-specific context — verify the job belongs to this recruiter
			if (!myJobIds.includes(String(jobId))) {
				res.status(403).json({ message: 'You do not have access to this job.' });
				return;
			}

			const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
			if (!snapshot) {
				res.status(400).json({ message: 'No screening results found for this job yet. Run screening first.' });
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
			res.json({ answer });
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to answer question' });
		}
	});

	// ── Recruiter decisions ──────────────────────────────────────────────────
	// Save a thumbs up/down for a candidate in a screening
	app.patch('/screening/decision', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId, applicationId, decision, note } = req.body || {};
			if (!jobId || !applicationId || !decision) {
				res.status(400).json({ message: 'jobId, applicationId, decision are required' });
				return;
			}
			if (!['approved', 'rejected', 'pending'].includes(decision)) {
				res.status(400).json({ message: 'decision must be approved, rejected, or pending' });
				return;
			}
			// Verify ownership
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (recruiterProfile) {
				const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
				if (!job) { res.status(403).json({ message: 'Access denied.' }); return; }
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
			if (!snapshot) { res.status(404).json({ message: 'No screening found for this job.' }); return; }

			// Ask Gemini to react to the decision
			if (process.env.GEMINI_API_KEY) {
				const ai = new GeminiAiService(process.env.GEMINI_API_KEY, { model: 'gemini-2.5-flash' });
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
				const aiComment = await ai.answerWithPrompt(prompt).catch(() => '');
				res.json({ ok: true, aiComment });
				return;
			}
			res.json({ ok: true });
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to save decision' });
		}
	});

	// Finalize screening — lock decisions, generate summary, save to DB
	app.post('/screening/finalize', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId } = req.body || {};
			if (!jobId) { res.status(400).json({ message: 'jobId is required' }); return; }
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (recruiterProfile) {
				const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
				if (!job) { res.status(403).json({ message: 'Access denied.' }); return; }
			}
			const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
			if (!snapshot) { res.status(404).json({ message: 'No screening found.' }); return; }

			const results = (snapshot.results as any[]) || [];
			const decisions = (snapshot.decisions as Record<string, any>) || {};
			const approved = results.filter((r: any) => decisions[r.applicationId]?.decision === 'approved');
			const rejected = results.filter((r: any) => decisions[r.applicationId]?.decision === 'rejected');
			const pending = results.filter((r: any) => !decisions[r.applicationId] || decisions[r.applicationId]?.decision === 'pending');

			let finalSummary = `Screening finalized. ${approved.length} approved, ${rejected.length} rejected, ${pending.length} pending.`;

			if (process.env.GEMINI_API_KEY) {
				const ai = new GeminiAiService(process.env.GEMINI_API_KEY, { model: 'gemini-2.5-flash' });
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
			res.json({ ok: true, finalSummary, approved: approved.length, rejected: rejected.length, pending: pending.length });
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to finalize' });
		}
	});

	// Get snapshot with decisions (for returning users)
	app.get('/screening/snapshot/:jobId', requireAuth, async (req: Request, res: Response) => {
		try {
			const { jobId } = req.params;
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (recruiterProfile) {
				const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile._id }).lean();
				if (!job) { res.status(403).json({ message: 'Access denied.' }); return; }
			}
			const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
			res.json(snapshot || null);
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to load snapshot' });
		}
	});

	// Decision Sessions (AI conversation)
	app.use('/api/sessions', sessionRoutes);
	app.get('/api/jobs/:jobId/session', requireAuth, async (req: Request, res: Response) => {
		const session = await DecisionSessionModel.findOne({ jobId: req.params.jobId, recruiterId: req.user!.id }).sort({ startedAt: -1 }).lean();
		if (!session) { res.status(404).json({ message: 'No session' }); return; }
		res.json(session);
	});

	// Bias
	app.get('/bias-audits', requireAuth, requireRole(['recruiter', 'admin']), BiasController.list);
	app.post('/bias-audits/:biasAuditId/dismiss', requireAuth, requireRole(['recruiter', 'admin']), BiasController.dismiss);

	// Ingestion (CSV/XLSX)
	app.post('/ingestion/csv', requireAuth, requireRole(['recruiter', 'admin']), upload.single('file'), IngestionController.ingestCsv);
	app.post('/ingestion/umurava', requireAuth, requireRole(['recruiter', 'admin']), IngestionController.ingestUmurava);
}

