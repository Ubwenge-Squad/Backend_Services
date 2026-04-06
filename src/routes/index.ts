import { Express, Request, Response } from 'express';
import multer from 'multer';
import { ScreeningOrchestrator } from '../ai/orchestrator';
import { ScreeningRunModel } from '../models/ScreeningRun.model';
import { ScreeningResultModel } from '../models/ScreeningResult.model';
import { AuthController } from '../Controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app: Express): void {
	// Auth
	app.post('/auth/register', AuthController.register);
	app.post('/auth/login', AuthController.login);
	app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
		res.json({ user: req.user });
	});
	app.post('/auth/logout', (_req: Request, res: Response) => res.status(204).send());
	app.post('/auth/verify', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/auth/resend-code', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Jobs
	app.get('/jobs', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/jobs', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/jobs/:jobId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.patch('/jobs/:jobId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/jobs/:jobId/activate', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/jobs/:jobId/close', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Applicants
	app.get('/applicants', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/applicants', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/applicants/:applicantId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.patch('/applicants/:applicantId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Resumes
	app.post('/resumes', upload.single('file'), (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/resumes/:resumeId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/resumes/:resumeId/parse', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Applications
	app.get('/applications', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/applications', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.patch('/applications/:applicationId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Screening
	app.post('/screening-runs', async (req: Request, res: Response) => {
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
			const orch = new ScreeningOrchestrator(process.env.GEMINI_API_KEY);
			const userId = (req as any).user?.id || 'system';
			const run = await orch.runForJob(jobId, userId, { topK: topK ?? batchSize, weightConfig, useCache });
			res.status(202).json(run);
		} catch (err: any) {
			res.status(500).json({ message: err?.message ?? 'Failed to start screening' });
		}
	});
	app.get('/screening-runs/:screeningRunId', async (req: Request, res: Response) => {
		const run = await ScreeningRunModel.findById(req.params.screeningRunId).lean();
		if (!run) {
			res.status(404).json({ message: 'Not found' });
			return;
		}
		res.json(run);
	});
	app.get('/screening-runs/:screeningRunId/results', async (req: Request, res: Response) => {
		const results = await ScreeningResultModel.find({ screeningRun: req.params.screeningRunId }).sort({ rankPosition: 1 }).lean();
		res.json(results);
	});
	app.get('/screening-results', async (req: Request, res: Response) => {
		const { jobId, top } = req.query as any;
		if (!jobId) {
			res.status(400).json({ message: 'jobId is required' });
			return;
		}
		// find latest completed run for job
		const run = await ScreeningRunModel.findOne({ job: jobId, status: 'completed' }).sort({ completedAt: -1 }).lean();
		if (!run) {
			res.json([]);
			return;
		}
		const limit = Number(top) || 20;
		const results = await ScreeningResultModel.find({ screeningRun: run._id }).sort({ rankPosition: 1 }).limit(limit).lean();
		res.json(results);
	});

	// Bias
	app.get('/bias-audits', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/bias-audits/:biasAuditId/dismiss', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Ingestion (CSV/XLSX)
	app.post('/ingestion/csv', upload.single('file'), (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
}

