import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { ResumeModel } from '../models/Resume.model';
import { uploadResumeBuffer } from '../services/cloudinary';
import { sendSuccess, sendError } from '../utils/response';

export const ResumesController = {
	async create(req: Request, res: Response): Promise<Response> {
		const uploadedFile = req.file;
		if (!uploadedFile?.buffer) {
			return sendError(res, 400, 'file is required', 'BAD_REQUEST');
		}
		const bodyApplicant = req.body?.applicant || req.body?.applicantId;
		let applicantProfileId = bodyApplicant;
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
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findById(applicantProfileId).lean();
			if (!profile || String(profile.user) !== req.user.id) {
				return sendError(res, 403, 'Forbidden: you can only upload your own resume', 'FORBIDDEN');
			}
		}
		const cloudinaryFile = await uploadResumeBuffer(uploadedFile.buffer, uploadedFile.originalname);
		const isPrimary =
			req.body.isPrimary === true ||
			req.body.isPrimary === 'true' ||
			req.body.isPrimary === 1 ||
			req.body.isPrimary === '1';
		const created = await ResumeModel.create({
			applicant: applicantProfileId,
			fileName: req.body.fileName || uploadedFile?.originalname || 'resume',
			fileUrl: cloudinaryFile.secure_url,
			fileSizeBytes: uploadedFile?.size,
			mimeType: req.body.mimeType || uploadedFile?.mimetype || 'application/pdf',
			isPrimary
		});
		return sendSuccess(res, created, 201);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const resumeId = String(req.params.resumeId ?? '');
		if (!mongoose.Types.ObjectId.isValid(resumeId)) {
			return sendError(res, 400, 'Invalid resumeId', 'BAD_REQUEST');
		}
		const resume = await ResumeModel.findById(resumeId).lean();
		if (!resume) {
			return sendError(res, 404, 'Resume not found', 'NOT_FOUND');
		}
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findById(resume.applicant).lean();
			if (!profile || String(profile.user) !== req.user.id) {
				return sendError(res, 403, 'Forbidden: you can only view your own resume', 'FORBIDDEN');
			}
		}
		return sendSuccess(res, resume);
	},

	async parse(req: Request, res: Response): Promise<Response> {
		const resumeId = String(req.params.resumeId ?? '');
		if (!mongoose.Types.ObjectId.isValid(resumeId)) {
			return sendError(res, 400, 'Invalid resumeId', 'BAD_REQUEST');
		}
		const parseVersion = (req.body?.parseVersion as string) || 'v1';
		const updated = await ResumeModel.findByIdAndUpdate(
			resumeId,
			{
				parsedText: req.body?.parsedText || '',
				parsedAt: new Date(),
				parseVersion
			},
			{ new: true, runValidators: true }
		).lean();
		if (!updated) {
			return sendError(res, 404, 'Resume not found', 'NOT_FOUND');
		}
		return sendSuccess(res, updated);
	}
};
