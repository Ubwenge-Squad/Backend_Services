import { Request, Response } from 'express';

export const IngestionController = {
	async ingestCsv(req: Request, res: Response): Promise<Response> {
		if (!req.file) {
			return res.status(400).json({ message: 'CSV file is required' });
		}
		// Placeholder: queue file parsing/normalization in background worker.
		return res.status(202).json({
			message: 'CSV ingestion accepted',
			fileName: req.file.originalname,
			sizeBytes: req.file.size
		});
	}
};
