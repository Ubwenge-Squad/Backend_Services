import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { parsePagination, toPaginatedResponse } from '../utils/pagination';

export const ApplicantsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const [applicants, total] = await Promise.all([
			ApplicantProfileModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			ApplicantProfileModel.countDocuments({})
		]);
		return res.json(toPaginatedResponse(applicants, page, limit, total));
	},

	async create(req: Request, res: Response): Promise<Response> {
		const { user, ...rest } = req.body || {};
		const userId = req.user?.role === 'applicant' ? req.user.id : user;
		if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ message: 'A valid user id is required' });
		}
		const existing = await ApplicantProfileModel.findOne({ user: userId }).lean();
		if (existing) {
			return res.status(409).json({ message: 'Applicant profile already exists for this user' });
		}
		const created = await ApplicantProfileModel.create({ user: userId, ...rest });
		return res.status(201).json(created);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const applicantId = String(req.params.applicantId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicantId)) {
			return res.status(400).json({ message: 'Invalid applicantId' });
		}
		const applicant = await ApplicantProfileModel.findById(applicantId).lean();
		if (!applicant) {
			return res.status(404).json({ message: 'Applicant not found' });
		}
		if (req.user?.role === 'applicant' && String(applicant.user) !== req.user.id) {
			return res.status(403).json({ message: 'Forbidden: you can only view your own profile' });
		}
		return res.json(applicant);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const applicantId = String(req.params.applicantId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicantId)) {
			return res.status(400).json({ message: 'Invalid applicantId' });
		}
		const existing = await ApplicantProfileModel.findById(applicantId).lean();
		if (!existing) {
			return res.status(404).json({ message: 'Applicant not found' });
		}
		if (req.user?.role === 'applicant' && String(existing.user) !== req.user.id) {
			return res.status(403).json({ message: 'Forbidden: you can only update your own profile' });
		}
		const updated = await ApplicantProfileModel.findByIdAndUpdate(applicantId, req.body || {}, {
			new: true,
			runValidators: true
		}).lean();
		return res.json(updated);
	}
};
