import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicationModel } from '../models/Application.model';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { parsePagination, toPaginatedResponse } from '../utils/pagination';

export const ApplicationsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
		const applicantId = typeof req.query.applicantId === 'string' ? req.query.applicantId : undefined;
		const query: Record<string, unknown> = {};
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile) {
				return res.json(toPaginatedResponse([], page, limit, 0));
			}
			query.applicant = profile._id;
		}
		if (req.user?.role === 'recruiter') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile) {
				return res.status(400).json({ message: 'Recruiter profile not found' });
			}
			const ownedJobs = await JobModel.find({ recruiter: recruiterProfile._id }).select('_id').lean();
			query.job = { $in: ownedJobs.map((job) => job._id) };
		}
		if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
			query.job = jobId;
		}
		if (applicantId && mongoose.Types.ObjectId.isValid(applicantId)) {
			query.applicant = applicantId;
		}
		const [applications, total] = await Promise.all([
			ApplicationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			ApplicationModel.countDocuments(query)
		]);
		return res.json(toPaginatedResponse(applications, page, limit, total));
	},

	async create(req: Request, res: Response): Promise<Response> {
		const { job, applicant, resume, coverLetter } = req.body || {};
		if (!job || !mongoose.Types.ObjectId.isValid(job)) {
			return res.status(400).json({ message: 'Valid job is required' });
		}
		let applicantProfileId = applicant;
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile) {
				return res.status(400).json({ message: 'Applicant profile not found' });
			}
			applicantProfileId = String(profile._id);
		}
		if (!applicantProfileId || !mongoose.Types.ObjectId.isValid(applicantProfileId)) {
			return res.status(400).json({ message: 'Valid job and applicant are required' });
		}
		const created = await ApplicationModel.create({ job, applicant: applicantProfileId, resume, coverLetter });
		return res.status(201).json(created);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const applicationId = String(req.params.applicationId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicationId)) {
			return res.status(400).json({ message: 'Invalid applicationId' });
		}
		const allowedFields = ['status', 'recruiterNotes', 'firstResponseMinutes', 'coverLetter', 'resume'];
		const updates = Object.fromEntries(
			Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key))
		);
		const existing = await ApplicationModel.findById(applicationId).lean();
		if (!existing) {
			return res.status(404).json({ message: 'Application not found' });
		}
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile || String(existing.applicant) !== String(profile._id)) {
				return res.status(403).json({ message: 'Forbidden: you can only update your own applications' });
			}
			if (updates.status && updates.status !== 'withdrawn') {
				return res.status(403).json({ message: 'Applicants can only withdraw applications' });
			}
			const applicantAllowedFields = ['status'];
			Object.keys(updates).forEach((key) => {
				if (!applicantAllowedFields.includes(key)) {
					delete (updates as Record<string, unknown>)[key];
				}
			});
		}
		if (req.user?.role === 'recruiter') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			const applicationJob = await JobModel.findById(existing.job).lean();
			if (!recruiterProfile || !applicationJob || String(applicationJob.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you can only update applications for your jobs' });
			}
		}
		const updated = await ApplicationModel.findByIdAndUpdate(applicationId, updates, {
			new: true,
			runValidators: true
		}).lean();
		return res.json(updated);
	}
};
