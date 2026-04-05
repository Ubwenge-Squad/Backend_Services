import { Express, Request, Response } from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app: Express): void {
	// Auth
	app.post('/auth/register', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/auth/login', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/auth/me', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/auth/logout', (_req: Request, res: Response) => res.status(204).send());

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
	app.post('/screening-runs', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/screening-runs/:screeningRunId', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/screening-runs/:screeningRunId/results', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.get('/screening-results', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Bias
	app.get('/bias-audits', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
	app.post('/bias-audits/:biasAuditId/dismiss', (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));

	// Ingestion (CSV/XLSX)
	app.post('/ingestion/csv', upload.single('file'), (_req: Request, res: Response) => res.status(501).json({ message: 'Not implemented' }));
}

