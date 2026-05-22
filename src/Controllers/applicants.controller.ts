import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { parsePagination } from '../utils/pagination';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

export const ApplicantsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const [applicants, total] = await Promise.all([
			ApplicantProfileModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			ApplicantProfileModel.countDocuments({})
		]);
		return sendPaginated(res, applicants, page, limit, total);
	},

	async create(req: Request, res: Response): Promise<Response> {
		const { user, ...rest } = req.body || {};
		const userId = req.user?.role === 'applicant' ? req.user.id : user;
		if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
			return sendError(res, 400, 'A valid user id is required', 'BAD_REQUEST');
		}
		const existing = await ApplicantProfileModel.findOne({ user: userId }).lean();
		if (existing) {
			return sendError(res, 409, 'Applicant profile already exists for this user', 'CONFLICT');
		}
		const created = await ApplicantProfileModel.create({ user: userId, ...rest });
		return sendSuccess(res, created, 201);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const applicantId = String(req.params.applicantId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicantId)) {
			return sendError(res, 400, 'Invalid applicantId', 'BAD_REQUEST');
		}
		const applicant = await ApplicantProfileModel.findById(applicantId).lean();
		if (!applicant) {
			return sendError(res, 404, 'Applicant not found', 'NOT_FOUND');
		}
		if (req.user?.role === 'applicant' && String(applicant.user) !== req.user.id) {
			return sendError(res, 403, 'Forbidden: you can only view your own profile', 'FORBIDDEN');
		}
		return sendSuccess(res, applicant);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const applicantId = String(req.params.applicantId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicantId)) {
			return sendError(res, 400, 'Invalid applicantId', 'BAD_REQUEST');
		}
		const existing = await ApplicantProfileModel.findById(applicantId).lean();
		if (!existing) {
			return sendError(res, 404, 'Applicant not found', 'NOT_FOUND');
		}
		if (req.user?.role === 'applicant' && String(existing.user) !== req.user.id) {
			return sendError(res, 403, 'Forbidden: you can only update your own profile', 'FORBIDDEN');
		}
		const updates = { ...(req.body || {}) };
		delete updates.user;
		const updated = await ApplicantProfileModel.findByIdAndUpdate(applicantId, updates, {
			new: true,
			runValidators: true
		}).lean();
		return sendSuccess(res, updated);
	}
};
