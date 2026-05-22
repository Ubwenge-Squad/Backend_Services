import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicationModel } from '../models/Application.model';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { PipelineLogModel } from '../models/PipelineLog.model';
import { sendSuccess, sendError } from '../utils/response';

const STAGES = ['submitted', 'screening', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'] as const;

export const PipelineController = {
	async getPipeline(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.params.jobId ?? '');
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return sendError(res, 400, 'Invalid jobId', 'BAD_REQUEST');
		}

		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			const job = await JobModel.findOne({ _id: jobId, recruiter: recruiterProfile?._id }).lean();
			if (!job) {
				return sendError(res, 403, 'Access denied', 'FORBIDDEN');
			}
		}

		const applications = await ApplicationModel.find({ job: jobId })
			.populate('applicant resume')
			.sort({ createdAt: -1 })
			.lean();

		const pipeline = STAGES.reduce((acc, stage) => {
			(acc as any)[stage] = applications.filter((a: any) => a.status === stage);
			return acc;
		}, {} as Record<string, any[]>);

		const stageCounts = STAGES.reduce((acc, stage) => {
			(acc as any)[stage] = applications.filter((a: any) => a.status === stage).length;
			return acc;
		}, {} as Record<string, number>);

		const logs = await PipelineLogModel.find({ job: jobId }).sort({ createdAt: -1 }).limit(100).lean();

		return sendSuccess(res, { pipeline, stageCounts, logs, total: applications.length });
	},

	async moveCandidate(req: Request, res: Response): Promise<Response> {
		const { applicationId, toStage, note } = req.body;
		if (!applicationId || !toStage) {
			return sendError(res, 400, 'applicationId and toStage are required', 'BAD_REQUEST');
		}
		if (!STAGES.includes(toStage)) {
			return sendError(res, 400, `Invalid stage. Must be one of: ${STAGES.join(', ')}`, 'BAD_REQUEST');
		}

		const application = await ApplicationModel.findById(applicationId);
		if (!application) {
			return sendError(res, 404, 'Application not found', 'NOT_FOUND');
		}

		if (req.user!.role !== 'admin') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user!.id }).lean();
			const job = await JobModel.findOne({ _id: application.job, recruiter: recruiterProfile?._id }).lean();
			if (!job) {
				return sendError(res, 403, 'Access denied', 'FORBIDDEN');
			}
		}

		const fromStage = application.status;
		application.status = toStage;
		await application.save();

		await PipelineLogModel.create({
			application: applicationId,
			job: application.job,
			fromStage,
			toStage,
			changedBy: req.user!.id,
			note,
		});

		return sendSuccess(res, { fromStage, toStage, applicationId });
	},

	async getStages(_req: Request, res: Response): Promise<Response> {
		return sendSuccess(res, { stages: STAGES });
	},
};
