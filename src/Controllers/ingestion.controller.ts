import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { JobModel } from '../models/Job.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { UserModel } from '../models/User.model';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { ApplicationModel } from '../models/Application.model';
import { normalizeApplicantFromExternal } from '../ai/normalized';

const RowSchema = z.object({
	name: z.string().min(1),
	email: z.string().email().optional(),
	phoneNumber: z.string().optional(),
	skills: z.array(z.string()).default([]),
	linkedinUrl: z.string().url().optional(),
	githubUrl: z.string().url().optional(),
	portfolioUrl: z.string().url().optional(),
	yearsOfExperience: z.number().optional(),
});

function splitSkills(v: unknown): string[] {
	const str = String(v ?? '').trim();
	if (!str) return [];
	return str
		.split(/[,;|]/g)
		.map((s) => s.trim())
		.filter(Boolean);
}

function getCell(row: Record<string, unknown>, keys: string[]): unknown {
	for (const k of keys) {
		const direct = row[k];
		if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
		// case-insensitive match
		const foundKey = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase().trim());
		if (foundKey) {
			const v = row[foundKey];
			if (v !== undefined && v !== null && String(v).trim() !== '') return v;
		}
	}
	return undefined;
}

function normalizeRow(row: Record<string, unknown>, idx: number, jobId: string) {
	const name = String(getCell(row, ['name', 'full name', 'candidate name']) ?? '').trim();
	const emailRaw = String(getCell(row, ['email', 'email address']) ?? '').trim();
	const phoneNumber = String(getCell(row, ['phone', 'phone number', 'mobile']) ?? '').trim();
	const skills = splitSkills(getCell(row, ['skills', 'skill', 'tech stack', 'stack']));
	const linkedinUrl = String(getCell(row, ['linkedin', 'linkedin url']) ?? '').trim();
	const githubUrl = String(getCell(row, ['github', 'github url']) ?? '').trim();
	const portfolioUrl = String(getCell(row, ['portfolio', 'portfolio url']) ?? '').trim();
	const yoeRaw = String(getCell(row, ['years', 'years of experience', 'experience years', 'yoe']) ?? '').trim();
	const yearsOfExperience = yoeRaw ? Number(yoeRaw) : undefined;

	// If email is missing/invalid, generate a stable local placeholder (unique).
	const email = emailRaw && emailRaw.includes('@')
		? emailRaw.toLowerCase()
		: `imported+${jobId}+${idx + 1}@intore.local`;

	return RowSchema.parse({
		name,
		email,
		phoneNumber: phoneNumber || undefined,
		skills,
		linkedinUrl: linkedinUrl.startsWith('http') ? linkedinUrl : undefined,
		githubUrl: githubUrl.startsWith('http') ? githubUrl : undefined,
		portfolioUrl: portfolioUrl.startsWith('http') ? portfolioUrl : undefined,
		yearsOfExperience: typeof yearsOfExperience === 'number' && !Number.isNaN(yearsOfExperience) ? yearsOfExperience : undefined,
	});
}

function parseCsvBuffer(buf: Buffer): Record<string, unknown>[] {
	const text = buf.toString('utf8');
	const parsed = Papa.parse<Record<string, unknown>>(text, {
		header: true,
		skipEmptyLines: true,
		dynamicTyping: false
	});
	if (parsed.errors?.length) {
		throw new Error(parsed.errors.map((e) => e.message).join('; '));
	}
	return (parsed.data || []).filter((r) => r && Object.keys(r).length > 0);
}

function parseXlsxBuffer(buf: Buffer): Record<string, unknown>[] {
	const wb = XLSX.read(buf, { type: 'buffer' });
	const sheetName = wb.SheetNames[0];
	const ws = wb.Sheets[sheetName];
	return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
}

export const IngestionController = {
	async ingestUmurava(req: Request, res: Response): Promise<Response> {
		const jobId = String(req.body?.jobId ?? '');
		const profiles = Array.isArray(req.body?.profiles) ? req.body.profiles : [];
		if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Valid jobId is required' });
		}
		if (!profiles.length) {
			return res.status(400).json({ message: 'profiles array is required' });
		}
		const job = await JobModel.findById(jobId).lean();
		if (!job) return res.status(404).json({ message: 'Job not found' });

		if (req.user?.role === 'recruiter') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile) return res.status(400).json({ message: 'Recruiter profile not found' });
			if (String(job.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you can only ingest for your own jobs' });
			}
		}

		let acceptedRows = 0;
		let rejectedRows = 0;

		for (let i = 0; i < profiles.length; i++) {
			try {
				const p = profiles[i] as Record<string, unknown>;
				const normalized = normalizeApplicantFromExternal({
					name: String(p.name ?? ''),
					skills: Array.isArray(p.skills) ? p.skills.map((x) => String(x)) : [],
					experience: typeof p.experience === 'number' ? p.experience : Number(p.experience ?? 0),
					education: String(p.education ?? 'Not specified'),
					projects: Array.isArray(p.projects) ? p.projects.map((x) => String(x)) : []
				});

				const email = String(p.email ?? `umurava+${jobId}+${i + 1}@intore.local`).toLowerCase();
				let user = await UserModel.findOne({ email }).lean();
				if (!user) {
					const passwordHash = await bcrypt.hash(`umurava:${jobId}:${i}:${Date.now()}`, 10);
					user = await UserModel.create({
						email,
						passwordHash,
						role: 'applicant',
						fullName: normalized.name,
						isActive: true,
						emailVerified: false,
						lastLoginAt: new Date()
					}).then((u) => u.toObject());
				}

				let profile = await ApplicantProfileModel.findOne({ user: user._id }).lean();
				if (!profile) {
					profile = await ApplicantProfileModel.create({
						user: user._id,
						skills: normalized.skills,
						yearsOfExperience: normalized.experience,
						education: normalized.education ? [{ institution: 'Umurava Import', degree: normalized.education }] : [],
						workExperience: normalized.projects.map((proj) => ({ company: 'Umurava', position: 'Project', description: proj }))
					}).then((x) => x.toObject());
				}

				try {
					await ApplicationModel.create({
						job: new mongoose.Types.ObjectId(jobId),
						applicant: profile._id,
						status: 'submitted',
						submittedAt: new Date(),
						ingestionSource: 'platform'
					} as any);
				} catch (err: any) {
					if (err?.code !== 11000) throw err;
				}
				acceptedRows += 1;
			} catch {
				rejectedRows += 1;
			}
		}

		return res.status(202).json({ jobId, acceptedRows, rejectedRows });
	},

	async ingestCsv(req: Request, res: Response): Promise<Response> {
		if (!req.file) {
			return res.status(400).json({ message: 'CSV file is required' });
		}
		const jobId = String(req.body?.jobId ?? '');
		if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: 'Valid jobId is required' });
		}

		const job = await JobModel.findById(jobId).lean();
		if (!job) {
			return res.status(404).json({ message: 'Job not found' });
		}

		// Enforce ownership for recruiters (admins can ingest for any job).
		if (req.user?.role === 'recruiter') {
			const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
			if (!recruiterProfile) {
				return res.status(400).json({ message: 'Recruiter profile not found' });
			}
			if (String(job.recruiter) !== String(recruiterProfile._id)) {
				return res.status(403).json({ message: 'Forbidden: you can only ingest for your own jobs' });
			}
		}

		let rows: Record<string, unknown>[] = [];
		try {
			const name = (req.file.originalname || '').toLowerCase();
			if (name.endsWith('.xlsx') || name.endsWith('.xls')) rows = parseXlsxBuffer(req.file.buffer);
			else rows = parseCsvBuffer(req.file.buffer);
		} catch (e: any) {
			return res.status(400).json({ message: 'Failed to parse file', details: e?.message ?? String(e) });
		}

		let acceptedRows = 0;
		let rejectedRows = 0;

		// Create per-row: User -> ApplicantProfile -> Application(job, applicantProfile)
		// Note: This is synchronous for simplicity. Later we can queue a worker.
		for (let i = 0; i < rows.length; i++) {
			try {
				const normalized = normalizeRow(rows[i], i, jobId);
				const email = normalized.email!.toLowerCase();

				let user = await UserModel.findOne({ email }).lean();
				if (!user) {
					// Imported applicants are created as role=applicant with a random password hash.
					const passwordHash = await bcrypt.hash(`imported:${jobId}:${i}:${Date.now()}`, 10);
					user = await UserModel.create({
						email,
						passwordHash,
						role: 'applicant',
						fullName: normalized.name,
						phoneNumber: normalized.phoneNumber,
						isActive: true,
						emailVerified: false,
						lastLoginAt: new Date()
					}).then((u) => u.toObject());
				}

				let profile = await ApplicantProfileModel.findOne({ user: user._id }).lean();
				if (!profile) {
					profile = await ApplicantProfileModel.create({
						user: user._id,
						skills: normalized.skills,
						yearsOfExperience: normalized.yearsOfExperience,
						linkedinUrl: normalized.linkedinUrl,
						githubUrl: normalized.githubUrl,
						portfolioUrl: normalized.portfolioUrl
					}).then((p) => p.toObject());
				} else {
					// Light merge: append new skills and fill missing fields.
					const mergedSkills = Array.from(new Set([...(profile.skills || []), ...(normalized.skills || [])]));
					await ApplicantProfileModel.updateOne(
						{ _id: profile._id },
						{
							$set: {
								skills: mergedSkills,
								yearsOfExperience: profile.yearsOfExperience ?? normalized.yearsOfExperience,
								linkedinUrl: profile.linkedinUrl ?? normalized.linkedinUrl,
								githubUrl: profile.githubUrl ?? normalized.githubUrl,
								portfolioUrl: profile.portfolioUrl ?? normalized.portfolioUrl
							}
						}
					);
				}

				// Create application (ignore duplicates)
				try {
					await ApplicationModel.create({
						job: new mongoose.Types.ObjectId(jobId),
						applicant: profile._id,
						status: 'submitted',
						submittedAt: new Date(),
						ingestionSource: 'csv'
					} as any);
				} catch (err: any) {
					// Duplicate (unique index job+applicant) => treat as accepted
					if (err?.code !== 11000) throw err;
				}

				acceptedRows += 1;
			} catch (e) {
				rejectedRows += 1;
			}
		}

		return res.status(202).json({
			jobId,
			acceptedRows,
			rejectedRows
		});
	}
};
