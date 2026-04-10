// ── Screening Types ─────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  skills: number; // 0-40
  experience: number; // 0-30
  education: number; // 0-15
  projectsAndCerts: number; // 0-10
  availability: number; // 0-5
}

export interface ScreenedCandidate {
  candidateIndex: number;
  name: string;
  rank: number;
  matchScore: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
  strengths: string[];
  gaps: string[];
  recommendation: string; // 2-3 sentences, recruiter-friendly
  reasoning?: string; // Detailed AI reasoning for the evaluation
  finalVerdict: "Strong Hire" | "Hire" | "Consider" | "Borderline";
}

export interface ScreeningResult {
  jobId: string;
  shortlist: ScreenedCandidate[];
  screeningSummary: string;
  createdAt: Date;
  totalCandidatesEvaluated: number;
  shortlistSize: number;
}

export interface JobProfile {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel?: string;
  contractType?: string;
  employmentType?: string;
  location?: string;
  minYearsExperience?: number;
}

export interface CandidateProfile {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  currentRole?: string;
  skills: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  yearsOfExperience?: number;
  education?: string[];
  workExperience?: Array<{
    company: string;
    position: string;
    description?: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    link?: string;
  }>;
  certifications?: string[];
  availability?: string;
  location?: string;
}

// MongoDB document interface for screenings collection
export interface ScreeningDocument extends ScreeningResult {
  _id: string;
}

// API request/response types
export interface RunScreeningRequest {
  jobId: string;
  candidateIds: string[];
  shortlistSize: 10 | 20;
}

export interface RunScreeningResponse {
  success: boolean;
  data?: ScreeningResult;
  error?: string;
}

export interface GetScreeningsResponse {
  success: boolean;
  data?: ScreeningResult[];
  error?: string;
}
