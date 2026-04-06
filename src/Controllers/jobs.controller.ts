import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { parsePagination, toPaginatedResponse } from '../utils/pagination';

export const JobsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const status = typeof req.query.status === 'string' ? req.query.status : undefined;
		const query = status ? { status } : {};
		const [jobs, total] = await Promise.all([
			JobModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			JobModel.countDocuments(query)
		]);
		return res.json(toPaginatedResponse(jobs, page, limit, total));
	},

	async create(req: Request, res: Response): Promise<Response> {
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
		if (!recruiterProfile) {
			return res.status(400).json({ message: 'Recruiter profile is required before creating jobs' });
		}
		const { title, description, requiredSkills, ...rest } = req.body || {};
		if (!title || !description) {
			return res.status(400).json({ message: 'title and description are required' });
		}
		const created = await JobModel.create({
			recruiter: recruiterProfile._id,
			title,
			description,
			requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
			...rest
		});
		return res.status(201).json(created);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Invalid jobId' });
		}
		const job = await JobModel.findById(jobId).lean();
		if (!job) {
			return res.status(404).json({ message: 'Job not found' });
		}
		return res.json(job);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Invalid jobId' });
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return res.status(404).json({ message: 'Job not found' });
		}
		if (req.user.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you do not own this job' });
			}
		}
		const updated = await JobModel.findByIdAndUpdate(jobId, req.body || {}, { new: true, runValidators: true }).lean();
		return res.json(updated);
	},

	async activate(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Invalid jobId' });
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return res.status(404).json({ message: 'Job not found' });
		}
		if (req.user.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you do not own this job' });
			}
		}
		const updated = await JobModel.findByIdAndUpdate(
			jobId,
			{ status: 'active', publishedAt: new Date() },
			{ new: true, runValidators: true }
		).lean();
		return res.json(updated);
	},

	async close(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Invalid jobId' });
		}
		const existing = await JobModel.findById(jobId).lean();
		if (!existing) {
			return res.status(404).json({ message: 'Job not found' });
		}
		if (req.user.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile || String(existing.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you do not own this job' });
			}
		}
		const updated = await JobModel.findByIdAndUpdate(
			jobId,
			{ status: 'closed', closedAt: new Date() },
			{ new: true, runValidators: true }
		).lean();
		return res.json(updated);
	}
};
