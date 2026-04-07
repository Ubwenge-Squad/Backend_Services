import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { ResumeModel } from '../models/Resume.model';
import { uploadResumeBuffer } from '../services/cloudinary';

export const ResumesController = {
	async create(req: Request, res: Response): Promise<Response> {
		const uploadedFile = req.file;
		if (!uploadedFile?.buffer) {
			return res.status(400).json({ message: 'file is required' });
		}
		const bodyApplicant = req.body?.applicant || req.body?.applicantId;
		let applicantProfileId = bodyApplicant;
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findOne({ user: req.user.id }).lean();
			if (!profile) {
				return res.status(400).json({ message: 'Applicant profile not found' });
			}
			applicantProfileId = String(profile._id);
		}
		if (!applicantProfileId || !mongoose.Types.ObjectId.isValid(applicantProfileId)) {
			return res.status(400).json({ message: 'Valid applicant is required' });
		}
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findById(applicantProfileId).lean();
			if (!profile || String(profile.user) !== req.user.id) {
				return res.status(403).json({ message: 'Forbidden: you can only upload your own resume' });
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
		return res.status(201).json(created);
	},

	async getById(req: Request, res: Response): Promise<Response> {
		const resumeId = String(req.params.resumeId ?? '');
		if (!mongoose.Types.ObjectId.isValid(resumeId)) {
			return res.status(400).json({ message: 'Invalid resumeId' });
		}
		const resume = await ResumeModel.findById(resumeId).lean();
		if (!resume) {
			return res.status(404).json({ message: 'Resume not found' });
		}
		if (req.user?.role === 'applicant') {
			const profile = await ApplicantProfileModel.findById(resume.applicant).lean();
			if (!profile || String(profile.user) !== req.user.id) {
				return res.status(403).json({ message: 'Forbidden: you can only view your own resume' });
			}
		}
		return res.json(resume);
	},

	async parse(req: Request, res: Response): Promise<Response> {
		const resumeId = String(req.params.resumeId ?? '');
		if (!mongoose.Types.ObjectId.isValid(resumeId)) {
			return res.status(400).json({ message: 'Invalid resumeId' });
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
			return res.status(404).json({ message: 'Resume not found' });
		}
		return res.json(updated);
	}
};
