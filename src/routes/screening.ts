import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobModel } from '../models/Job.model';
import { ApplicantProfileModel } from '../models/ApplicantProfile.model';
import { ApplicationModel } from '../models/Application.model';
import { RecruiterProfileModel } from '../models/RecruiterProfile.model';
import { aiScreeningService } from '../services/aiScreeningService';
import { 
  RunScreeningRequest, 
  RunScreeningResponse, 
  GetScreeningsResponse,
  ScreeningDocument 
} from '../types/screening';

// MongoDB Schema for screenings
const ScreeningSchema = new mongoose.Schema<ScreeningDocument>({
  jobId: { type: String, required: true, index: true },
  shortlist: [{
    candidateIndex: { type: Number, required: true },
    name: { type: String, required: true },
    rank: { type: Number, required: true },
    matchScore: { type: Number, required: true },
    scoreBreakdown: {
      skills: { type: Number, required: true },
      experience: { type: Number, required: true },
      education: { type: Number, required: true },
      projectsAndCerts: { type: Number, required: true },
      availability: { type: Number, required: true }
    },
    strengths: [{ type: String }],
    gaps: [{ type: String }],
    recommendation: { type: String, required: true },
    reasoning: { type: String },
    finalVerdict: { type: String, required: true, enum: ['Strong Hire', 'Hire', 'Consider', 'Borderline'] }
  }],
  screeningSummary: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  totalCandidatesEvaluated: { type: Number, required: true },
  shortlistSize: { type: Number, required: true }
}, { timestamps: true });

const ScreeningModel = mongoose.models.Screening || mongoose.model<ScreeningDocument>('Screening', ScreeningSchema);

export const ScreeningController = {
  async runScreening(req: Request, res: Response): Promise<Response> {
    try {
      const { jobId, candidateIds, shortlistSize }: RunScreeningRequest = req.body;

      // Validate request
      if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid jobId is required'
        } as RunScreeningResponse);
      }

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'candidateIds array is required and cannot be empty'
        } as RunScreeningResponse);
      }

      if (![10, 20].includes(shortlistSize)) {
        return res.status(400).json({
          success: false,
          error: 'shortlistSize must be either 10 or 20'
        } as RunScreeningResponse);
      }

      // Get job details
      const job = await JobModel.findById(jobId).lean();
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        } as RunScreeningResponse);
      }

      // Verify ownership for recruiters
      if (req.user?.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
        if (!recruiterProfile) {
          return res.status(400).json({
            success: false,
            error: 'Recruiter profile not found'
          } as RunScreeningResponse);
        }
        if (String(job.recruiter) !== String(recruiterProfile._id)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: you can only screen candidates for your own jobs'
          } as RunScreeningResponse);
        }
      }

      // Get candidate profiles
      const candidates = await ApplicantProfileModel.find({
        _id: { $in: candidateIds }
      }).populate('user').lean();

      if (candidates.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No valid candidates found'
        } as RunScreeningResponse);
      }

      // Transform candidates to the format expected by AI service
      const candidateProfiles = candidates.map((candidate: any, index: number) => ({
        _id: candidate._id?.toString(),
        id: candidate._id?.toString(),
        name: candidate.user?.fullName || candidate.name || `Candidate ${index + 1}`,
        email: candidate.user?.email,
        phone: candidate.user?.phoneNumber,
        currentRole: candidate.headline,
        skills: candidate.skills || [],
        linkedinUrl: candidate.linkedinUrl,
        githubUrl: candidate.githubUrl,
        portfolioUrl: candidate.portfolioUrl,
        yearsOfExperience: candidate.yearsOfExperience,
        education: candidate.education?.map((edu: any) => `${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution}`),
        workExperience: candidate.workExperience?.map((exp: any) => ({
          company: exp.company,
          position: exp.position,
          description: exp.description
        })),
        projects: [], // Could be populated from other collections if needed
        certifications: [], // Could be populated from other collections if needed
        availability: 'Not specified', // Could be enhanced with availability data
        location: candidate.location
      }));

      // Transform job to the format expected by AI service
      const jobProfile = {
        _id: job._id?.toString(),
        id: job._id?.toString(),
        title: job.title,
        description: job.description,
        requiredSkills: job.requiredSkills || [],
        experienceLevel: job.experienceLevel,
        contractType: job.contractType,
        employmentType: job.employmentType,
        location: job.location,
        minYearsExperience: job.minYearsExperience
      };

      // Run AI screening
      const screeningResult = await aiScreeningService.screenCandidates(
        jobProfile,
        candidateProfiles,
        shortlistSize
      );

      // Save screening result to database
      const savedScreening = await ScreeningModel.create(screeningResult);

      return res.status(200).json({
        success: true,
        data: savedScreening.toObject()
      } as RunScreeningResponse);

    } catch (error) {
      console.error('Screening failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Screening failed'
      } as RunScreeningResponse);
    }
  },

  async getScreenings(req: Request, res: Response): Promise<Response> {
    try {
      const { jobId } = req.params;

      if (!jobId || !mongoose.Types.ObjectId.isValid(String(jobId))) {
        return res.status(400).json({
          success: false,
          error: 'Valid jobId is required'
        } as GetScreeningsResponse);
      }

      // Get job to verify ownership
      const job = await JobModel.findById(jobId).lean();
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        } as GetScreeningsResponse);
      }

      // Verify ownership for recruiters
      if (req.user?.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfileModel.findOne({ user: req.user.id }).lean();
        if (!recruiterProfile) {
          return res.status(400).json({
            success: false,
            error: 'Recruiter profile not found'
          } as GetScreeningsResponse);
        }
        if (String(job.recruiter) !== String(recruiterProfile._id)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: you can only view screenings for your own jobs'
          } as GetScreeningsResponse);
        }
      }

      // Get screenings for this job, newest first
      const screenings = await ScreeningModel
        .find({ jobId })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: screenings
      } as GetScreeningsResponse);

    } catch (error) {
      console.error('Failed to get screenings:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get screenings'
      } as GetScreeningsResponse);
    }
  }
};
