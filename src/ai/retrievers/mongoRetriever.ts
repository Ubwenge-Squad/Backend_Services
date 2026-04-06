import { ApplicationModel } from '../../models/Application.model';
import { ApplicantProfileModel } from '../../models/ApplicantProfile.model';
import { ResumeModel } from '../../models/Resume.model';
import { JobModel } from '../../models/Job.model';

export async function getJobWithApplicants(jobId: string) {
	const job = await JobModel.findById(jobId).lean();
	if (!job) return { job: null, applicants: [] };
	const applications = await ApplicationModel.find({ job: job._id }).lean();
	const applicantIds = applications.map((a) => a.applicant);
	const applicants = await ApplicantProfileModel.find({ _id: { $in: applicantIds } }).lean();
	const resumes = await ResumeModel.find({ applicant: { $in: applicantIds }, isPrimary: true }).lean();
	const resumeByApplicant: Record<string, any> = {};
	for (const r of resumes) resumeByApplicant[String(r.applicant)] = r;
	const enriched = applications.map((a) => {
		const ap = applicants.find((p) => String(p._id) === String(a.applicant));
		const r = resumeByApplicant[String(a.applicant)];
		return {
			applicationId: String(a._id),
			applicantId: String(a.applicant),
			skills: ap?.skills ?? [],
			yearsOfExperience: ap?.yearsOfExperience ?? 0,
			education: ap?.education ?? [],
			workExperience: ap?.workExperience ?? [],
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

