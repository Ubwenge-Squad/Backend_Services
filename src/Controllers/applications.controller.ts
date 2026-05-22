import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicationModel } from '../models/Application.model';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { parsePagination } from '../utils/pagination';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

export const ApplicationsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const { page, limit, skip } = parsePagination(req);
		const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
		const applicantId = typeof req.query.applicantId === 'string' ? req.query.applicantId : undefined;
		const query: Record<string, unknown> = {};
		let authenticatedApplicantId: string | undefined;
		let recruiterOwnedJobIds: string[] | undefined;

		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile) {
				return sendPaginated(res, [], page, limit, 0);
			}
			authenticatedApplicantId = String(profile._id);
			query.applicant = authenticatedApplicantId;
		}
		if (req.user?.role === 'recruiter') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile) {
				return sendError(res, 400, 'Recruiter profile not found', 'BAD_REQUEST');
			}
			const ownedJobs = await JobModel.find({ recruiter: recruiterProfile._id }).select('_id').lean();
			recruiterOwnedJobIds = ownedJobs.map((j) => String(j._id));
			query.job = { $in: recruiterOwnedJobIds };
		}
		if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
			if (req.user?.role === 'recruiter' && recruiterOwnedJobIds && !recruiterOwnedJobIds.includes(jobId)) {
				return sendError(res, 403, 'Forbidden: you can only view applications for your jobs', 'FORBIDDEN');
			}
			query.job = jobId;
		}
		if (applicantId && mongoose.Types.ObjectId.isValid(applicantId)) {
			if (req.user?.role === 'applicant' && authenticatedApplicantId && applicantId !== authenticatedApplicantId) {
				return sendError(res, 403, 'Forbidden: you can only view your own applications', 'FORBIDDEN');
			}
			query.applicant = applicantId;
		}
		const [applications, total] = await Promise.all([
			ApplicationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			ApplicationModel.countDocuments(query)
		]);
		return sendPaginated(res, applications, page, limit, total);
	},

	async create(req: Request, res: Response): Promise<Response> {
		const { job, applicant, resume, coverLetter } = req.body || {};
		if (!job || !mongoose.Types.ObjectId.isValid(job)) {
			return sendError(res, 400, 'Valid job is required', 'BAD_REQUEST');
		}
		let applicantProfileId = applicant;
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile) {
				return sendError(res, 400, 'Applicant profile not found', 'BAD_REQUEST');
			}
			applicantProfileId = String(profile._id);
		}
		if (!applicantProfileId || !mongoose.Types.ObjectId.isValid(applicantProfileId)) {
			return sendError(res, 400, 'Valid applicant is required', 'BAD_REQUEST');
		}
		const created = await ApplicationModel.create({ job, applicant: applicantProfileId, resume, coverLetter });
		return sendSuccess(res, created, 201);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const applicationId = String(req.params.applicationId ?? '');
		if (!mongoose.Types.ObjectId.isValid(applicationId)) {
			return sendError(res, 400, 'Invalid applicationId', 'BAD_REQUEST');
		}
		const allowedFields = ['status', 'recruiterNotes', 'firstResponseMinutes', 'coverLetter', 'resume'];
		const updates = Object.fromEntries(
			Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key))
		);
		const existing = await ApplicationModel.findById(applicationId).lean();
		if (!existing) {
			return sendError(res, 404, 'Application not found', 'NOT_FOUND');
		}
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile || String(existing.applicant) !== String(profile._id)) {
				return sendError(res, 403, 'Forbidden: you can only update your own applications', 'FORBIDDEN');
			}
			if (updates.status && updates.status !== 'withdrawn') {
				return sendError(res, 403, 'Applicants can only withdraw applications', 'FORBIDDEN');
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
				return sendError(res, 403, 'Forbidden: you can only update applications for your jobs', 'FORBIDDEN');
			}
		}
		const updated = await ApplicationModel.findByIdAndUpdate(applicationId, updates, {
			new: true,
			runValidators: true
		}).lean();
		return sendSuccess(res, updated);
	}
};
