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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app: Express): void {
	// Auth
	app.post('	', AuthController.register);
	app.post('/auth/login', AuthController.login);
	app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
		res.json({ user: req.user });
	});
	app.post('/auth/logout', (_req: Request, res: Response) => res.status(204).send());
	app.post('/auth/verify', AuthController.verify);
	app.post('/auth/resend-code', AuthController.resendCode);
	app.post('/auth/verify-login-otp', AuthController.verifyLoginOtp);

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

			// General context: no specific job or jobId === 'general'
			if (!jobId || jobId === 'general') {
				// Try to find the most recent snapshot for this recruiter's jobs
				const latestSnapshot = await ScreeningSnapshotModel.findOne().sort({ updatedAt: -1 }).lean();
				if (!latestSnapshot) {
					const generalPrompt = [
						'You are Intore AI, an expert recruiter assistant for Rwanda-based hiring.',
						'No screening data is available yet. Answer the recruiter\'s question helpfully and suggest next steps.',
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

			// Job-specific context
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

	// Bias
	app.get('/bias-audits', requireAuth, requireRole(['recruiter', 'admin']), BiasController.list);
	app.post('/bias-audits/:biasAuditId/dismiss', requireAuth, requireRole(['recruiter', 'admin']), BiasController.dismiss);

	// Ingestion (CSV/XLSX)
	app.post('/ingestion/csv', requireAuth, requireRole(['recruiter', 'admin']), upload.single('file'), IngestionController.ingestCsv);
	app.post('/ingestion/umurava', requireAuth, requireRole(['recruiter', 'admin']), IngestionController.ingestUmurava);
}

