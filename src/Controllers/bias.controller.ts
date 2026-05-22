import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { BiasAuditLogModel } from '../models/BiasAuditLog.model';
import { parsePagination } from '../utils/pagination';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

export const BiasController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const screeningRunId = typeof req.query.screeningRunId === 'string' ? req.query.screeningRunId : undefined;
		const query: Record<string, unknown> = {};
		if (screeningRunId && mongoose.Types.ObjectId.isValid(screeningRunId)) {
			query.screeningRun = screeningRunId;
		}
		const [audits, total] = await Promise.all([
			BiasAuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			BiasAuditLogModel.countDocuments(query)
		]);
		return sendPaginated(res, audits, page, limit, total);
	},

	async dismiss(req: Request, res: Response): Promise<Response> {
		const biasAuditId = String(req.params.biasAuditId ?? '');
		if (!mongoose.Types.ObjectId.isValid(biasAuditId)) {
			return sendError(res, 400, 'Invalid biasAuditId', 'BAD_REQUEST');
		}
		const updated = await BiasAuditLogModel.findByIdAndUpdate(
			biasAuditId,
			{
				dismissed: true,
				dismissedAt: new Date(),
				dismissedBy: req.user?.id
			},
			{ new: true, runValidators: true }
		).lean();
		if (!updated) {
			return sendError(res, 404, 'Bias audit log not found', 'NOT_FOUND');
		}
		return sendSuccess(res, updated);
	}
};
