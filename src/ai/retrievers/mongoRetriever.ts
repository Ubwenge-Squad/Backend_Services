import { ApplicationModel } from '../../models/Application.model';
import { ApplicantProfileModel } from '../../models/ApplicantProfile.model';
import { ResumeModel } from '../../models/Resume.model';
import { JobModel } from '../../models/Job.model';
import { UserModel } from '../../models/User.model';
import { normalizeApplicantFromProfile } from '../normalized';

export async function getJobWithApplicants(jobId: string) {
	const job = await JobModel.findById(jobId).lean();
	if (!job) return { job: null, applicants: [] };
	const applications = await ApplicationModel.find({ job: job._id }).lean();
	const applicantIds = applications.map((a) => a.applicant);
	const applicants = await ApplicantProfileModel.find({ _id: { $in: applicantIds } }).lean();
	const users = await UserModel.find({ _id: { $in: applicants.map((a) => a.user) } }).lean();
	const resumes = await ResumeModel.find({ applicant: { $in: applicantIds }, isPrimary: true }).lean();
	const resumeByApplicant: Record<string, any> = {};
	for (const r of resumes) resumeByApplicant[String(r.applicant)] = r;
	const enriched = applications.map((a) => {
		const ap = applicants.find((p) => String(p._id) === String(a.applicant));
		const u = users.find((x) => String(x._id) === String(ap?.user));
		const r = resumeByApplicant[String(a.applicant)];
		const normalized = normalizeApplicantFromProfile({
			fullName: u?.fullName,
			skills: ap?.skills,
			yearsOfExperience: ap?.yearsOfExperience,
			education: ap?.education,
			workExperience: ap?.workExperience,
			parsedResumeText: r?.parsedText ?? null
		});
		return {
			applicationId: String(a._id),
			applicantId: String(a.applicant),
			normalized,
			name: normalized.name,
			skills: normalized.skills,
			yearsOfExperience: normalized.experience,
			education: normalized.education,
			projects: normalized.projects,
			resumeText: r?.parsedText ?? null,
			links: {
				linkedinUrl: ap?.linkedinUrl ?? null,
				githubUrl: ap?.githubUrl ?? null,
				portfolioUrl: ap?.portfolioUrl ?? null
			}
		};
	});
	return { job, applicants: enriched };
}

