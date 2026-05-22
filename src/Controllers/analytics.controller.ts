import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobModel } from '../models/Job.model';
import { ApplicationModel } from '../models/Application.model';
import { ScreeningRunModel } from '../models/ScreeningRun.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { PipelineLogModel } from '../models/PipelineLog.model';
import { sendSuccess } from '../utils/response';

export const AnalyticsController = {
	async recruiterDashboard(req: Request, res: Response): Promise<Response> {
		const userId = req.user!.id;
		const recruiterProfile = await RecruiterProfileModel.findOne({ user: userId }).lean();
		if (!recruiterProfile) {
			return sendSuccess(res, {
				totalJobs: 0, activeJobs: 0, draftJobs: 0, totalCandidates: 0,
				pipelineBreakdown: {}, recentActivity: [], screeningStats: null,
			});
		}

		const jobs = await JobModel.find({ recruiter: recruiterProfile._id }).lean();
		const jobIds = jobs.map((j) => j._id);
		const activeJobs = jobs.filter((j) => j.status === 'active').length;
		const draftJobs = jobs.filter((j) => j.status === 'draft').length;

		const totalCandidates = await ApplicationModel.countDocuments({ job: { $in: jobIds } });

		const pipelineBreakdown = await ApplicationModel.aggregate([
			{ $match: { job: { $in: jobIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
			{ $group: { _id: '$status', count: { $sum: 1 } } },
		]);

		const recentLogs = await PipelineLogModel.find({ job: { $in: jobIds } })
			.sort({ createdAt: -1 })
			.limit(20)
			.populate('application')
			.lean();

		const latestRun = await ScreeningRunModel.findOne({ job: { $in: jobIds } })
			.sort({ createdAt: -1 })
			.lean();

		const screeningStats = latestRun
			? {
				lastRunAt: latestRun.createdAt,
				totalCandidates: latestRun.totalCandidates,
				status: latestRun.status,
				modelVersion: latestRun.modelVersion,
				duration: latestRun.completedAt && latestRun.startedAt
					? Math.round((new Date(latestRun.completedAt).getTime() - new Date(latestRun.startedAt).getTime()) / 1000)
					: null,
			}
			: null;

		return sendSuccess(res, {
			totalJobs: jobs.length,
			activeJobs,
			draftJobs,
			totalCandidates,
			pipelineBreakdown: Object.fromEntries(pipelineBreakdown.map((p: any) => [p._id, p.count])),
			recentActivity: recentLogs.map((log: any) => ({
				applicationId: log.application?._id,
				fromStage: log.fromStage,
				toStage: log.toStage,
				note: log.note,
				createdAt: log.createdAt,
			})),
			screeningStats,
		});
	},
};
