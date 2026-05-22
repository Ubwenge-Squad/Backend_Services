import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { parsePagination, toPaginatedResponse } from '../utils/pagination';
import { sendSuccess, sendError } from '../utils/response';

export const JobsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const status = typeof req.query.status === 'string' ? req.query.status : undefined;

		const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
		if (!recruiterProfile) {
			return sendSuccess(res, toPaginatedResponse([], page, limit, 0));
		}

		const query: Record<string, unknown> = { recruiter: recruiterProfile._id };
		if (status) query.status = status;

		const [jobs, total] = await Promise.all([
			JobModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			JobModel.countDocuments(query)
		]);
		return sendSuccess(res, toPaginatedResponse(jobs, page, limit, total));
	},

	async create(req: Request, res: Response): Promise<Response> {
		const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
		if (!recruiterProfile) {
			return sendError(res, 400, 'Recruiter profile is required before creating jobs', 'BAD_REQUEST');
		}
		const { title, description, requiredSkills, ...rest } = req.body || {};
		if (!title || !description) {
			return sendError(res, 400, 'title and description are required', 'BAD_REQUEST');
		}
		const created = await JobModel.create({
			recruiter: recruiterProfile._id,
			title,
			description,
			requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
			...rest
		});
		return sendSuccess(res, created, 201);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}
		const job = await JobModel.findById(jobId).lean();
		if (!job) {
			return sendError(res, 404, 'Job not found', 'NOT_FOUND');
		}
		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (!recruiterProfile || String(job.recruiter) !== String(recruiterProfile._id)) {
				return sendError(res, 403, 'Forbidden: you do not own this job', 'FORBIDDEN');
			}
		}
		return sendSuccess(res, job);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return sendError(res, 404, 'Job not found', 'NOT_FOUND');
		}
		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return sendError(res, 403, 'Forbidden: you do not own this job', 'FORBIDDEN');
			}
		}
		const updates = { ...(req.body || {}) };
		delete updates.recruiter;
		const updated = await JobModel.findByIdAndUpdate(jobId, updates, { new: true, runValidators: true }).lean();
		return sendSuccess(res, updated);
	},

	async activate(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return sendError(res, 404, 'Job not found', 'NOT_FOUND');
		}
		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return sendError(res, 403, 'Forbidden: you do not own this job', 'FORBIDDEN');
			}
		}
		const updated = await JobModel.findByIdAndUpdate(
			jobId,
			{ status: 'active', publishedAt: new Date() },
			{ new: true, runValidators: true }
		).lean();
		return sendSuccess(res, updated);
	},

	async close(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return sendError(res, 404, 'Job not found', 'NOT_FOUND');
		}
		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return sendError(res, 403, 'Forbidden: you do not own this job', 'FORBIDDEN');
			}
		}
		const updated = await JobModel.findByIdAndUpdate(
			jobId,
			{ status: 'closed', closedAt: new Date() },
			{ new: true, runValidators: true }
		).lean();
		return sendSuccess(res, updated);
	},

	async delete(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return sendError(res, 404, 'Job not found', 'NOT_FOUND');
		}
		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return sendError(res, 403, 'Forbidden: you do not own this job', 'FORBIDDEN');
			}
		}
		await JobModel.findByIdAndDelete(jobId);
		return res.status(204).send();
	}
};
