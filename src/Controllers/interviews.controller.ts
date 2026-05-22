import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { InterviewModel } from '../models/Interview.model';
import { ApplicationModel } from '../models/Application.model';
import { NotificationModel } from '../models/Notification.model';
import { sendSuccess, sendError } from '../utils/response';

export const InterviewsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const query: Record<string, unknown> = {};
		if (typeof req.query.application === 'string') query.application = req.query.application;
		if (typeof req.query.status === 'string') query.status = req.query.status;
		const interviews = await InterviewModel.find(query)
			.sort({ scheduledAt: -1 })
			.populate('application')
			.lean();
		return sendSuccess(res, interviews);
	},

	async schedule(req: Request, res: Response): Promise<Response> {
		const { applicationId, scheduledAt, durationMinutes, interviewType, locationOrLink, panelMembers } = req.body;
		if (!applicationId || !scheduledAt) {
			return sendError(res, 400, 'applicationId and scheduledAt are required', 'BAD_REQUEST');
		}
		const application = await ApplicationModel.findById(applicationId).lean();
		if (!application) {
			return sendError(res, 404, 'Application not found', 'NOT_FOUND');
		}

		const interview = await InterviewModel.create({
			application: applicationId,
			scheduledBy: req.user!.id,
			scheduledAt: new Date(scheduledAt),
			durationMinutes: durationMinutes || 60,
			interviewType: interviewType || 'technical',
			locationOrLink,
			panelMembers: panelMembers || [],
		});

		await ApplicationModel.findByIdAndUpdate(applicationId, { status: 'interviewed' });

		await NotificationModel.create({
			user: application.applicant,
			type: 'interview_scheduled',
			title: 'Interview Scheduled',
			body: `You have an interview scheduled for ${new Date(scheduledAt).toLocaleDateString()}`,
			actionUrl: `/applicant/dashboard`,
		});

		return sendSuccess(res, interview, 201);
	},

	async update(req: Request, res: Response): Promise<Response> {
		const interviewId = String(req.params.interviewId ?? '');
		if (!mongoose.Types.ObjectId.isValid(interviewId)) {
			return sendError(res, 400, 'Invalid interviewId', 'BAD_REQUEST');
		}
		const allowed = ['status', 'scheduledAt', 'durationMinutes', 'locationOrLink', 'feedback', 'rating', 'interviewType'];
		const updates = Object.fromEntries(
			Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))
		);
		if (req.body.status === 'completed' && !updates.feedback) {
			return sendError(res, 400, 'Feedback is required when completing an interview', 'BAD_REQUEST');
		}
		const updated = await InterviewModel.findByIdAndUpdate(interviewId, updates, { new: true, runValidators: true }).lean();
		if (!updated) {
			return sendError(res, 404, 'Interview not found', 'NOT_FOUND');
		}
		return sendSuccess(res, updated);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const interviewId = String(req.params.interviewId ?? '');
		if (!mongoose.Types.ObjectId.isValid(interviewId)) {
			return sendError(res, 400, 'Invalid interviewId', 'BAD_REQUEST');
		}
		const interview = await InterviewModel.findById(interviewId).populate('application').lean();
		if (!interview) {
			return sendError(res, 404, 'Interview not found', 'NOT_FOUND');
		}
		return sendSuccess(res, interview);
	},
};
