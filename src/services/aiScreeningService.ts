import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface SkillEntry {
  name: string;
  level?: string;
  yearsOfExperience?: number;
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
  finalVerdict: "Strong Hire" | "Hire" | "Consider" | "Borderline";
  reasoning?: string; // Detailed AI reasoning for the evaluation
}

export interface ScreeningResult {
  jobId: string;
  shortlist: ScreenedCandidate[];
  screeningSummary: string;
  createdAt: Date;
  totalCandidatesEvaluated: number;
  shortlistSize: number;
}

// ── AI Screening Service ─────────────────────────────────────────────────────

export class AiScreeningService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16384,
        responseMimeType: "text/plain"
      }
    });
  }

  async screenCandidates(
    job: JobProfile,
    candidates: CandidateProfile[],
    shortlistSize: 10 | 20
  ): Promise<ScreeningResult> {
    const prompt = this.buildScreeningPrompt(job, candidates, shortlistSize);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse human-friendly text response
      const parsedResponse = this.parseHumanFriendlyResponse(text);
      const shortlist = parsedResponse.candidates;
      const screeningSummary = parsedResponse.summary || 'AI screening completed successfully.';

      // Ensure all required fields are present and valid
      const validatedShortlist = shortlist.map((candidate: any, index: number) => ({
        candidateIndex: candidate.candidateIndex || index,
        name: candidate.name || `Candidate ${index + 1}`,
        rank: candidate.rank || index + 1,
        matchScore: Math.min(100, Math.max(0, candidate.matchScore || 0)),
        scoreBreakdown: {
          skills: Math.min(40, Math.max(0, candidate.scoreBreakdown?.skills || 0)),
          experience: Math.min(30, Math.max(0, candidate.scoreBreakdown?.experience || 0)),
          education: Math.min(15, Math.max(0, candidate.scoreBreakdown?.education || 0)),
          projectsAndCerts: Math.min(10, Math.max(0, candidate.scoreBreakdown?.projectsAndCerts || 0)),
          availability: Math.min(5, Math.max(0, candidate.scoreBreakdown?.availability || 0))
        },
        strengths: Array.isArray(candidate.strengths) ? candidate.strengths : [],
        gaps: Array.isArray(candidate.gaps) ? candidate.gaps : [],
        recommendation: candidate.recommendation || 'Candidate evaluated based on job requirements.',
        reasoning: candidate.reasoning || 'Detailed AI analysis completed for this candidate.',
        finalVerdict: ["Strong Hire", "Hire", "Consider", "Borderline"].includes(candidate.finalVerdict) 
          ? candidate.finalVerdict as any 
          : "Consider"
      }));

      return {
        jobId: job._id || job.id || '',
        shortlist: validatedShortlist.slice(0, shortlistSize),
        screeningSummary,
        createdAt: new Date(),
        totalCandidatesEvaluated: candidates.length,
        shortlistSize
      };

    } catch (error) {
      console.error('AI screening failed:', error);
      throw new Error(`AI screening failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildScreeningPrompt(
    job: JobProfile, 
    candidates: CandidateProfile[], 
    shortlistSize: number
  ): string {
    return `You are an expert AI recruitment assistant with deep expertise in talent evaluation, technical assessment, and recruiting best practices. Your task is to conduct a comprehensive evaluation of candidates for a specific job and return a detailed, ranked shortlist with thorough reasoning.

JOB DETAILS:
- Title: ${job.title}
- Description: ${job.description}
- Required Skills: ${job.requiredSkills.join(', ')}
- Experience Level: ${job.experienceLevel || 'Not specified'}
- Minimum Years of Experience: ${job.minYearsExperience || 'Not specified'}
- Location: ${job.location || 'Not specified'}

CANDIDATES TO EVALUATE:
${candidates.map((candidate, index) => `
Candidate ${index + 1}:
- Name: ${candidate.name}
- Current Role: ${candidate.currentRole || 'Not specified'}
- Skills: ${candidate.skills.join(', ')}
- Years of Experience: ${candidate.yearsOfExperience || 'Not specified'}
- Education: ${candidate.education?.join(', ') || 'Not specified'}
- Work Experience: ${candidate.workExperience?.map(exp => `${exp.position} at ${exp.company}${exp.description ? ` (${exp.description})` : ''}`).join(', ') || 'Not specified'}
- Projects: ${candidate.projects?.map(proj => `${proj.name}${proj.description ? `: ${proj.description}` : ''}${proj.link ? ` (Link: ${proj.link})` : ''}`).join(', ') || 'Not specified'}
- Certifications: ${candidate.certifications?.join(', ') || 'Not specified'}
- Availability: ${candidate.availability || 'Not specified'}
- Location: ${candidate.location || 'Not specified'}
- LinkedIn: ${candidate.linkedinUrl || 'Not provided'}
- GitHub: ${candidate.githubUrl || 'Not provided'}
- Portfolio: ${candidate.portfolioUrl || 'Not provided'}
`).join('\n')}

EVALUATION FRAMEWORK:
Use these exact weights for scoring:
- Skills Match: 40% (Technical proficiency, relevance to job requirements, skill depth)
- Work Experience: 30% (Relevance, progression, company quality, impact)
- Education: 15% (Relevant degrees, institutions, continuous learning)
- Projects & Certifications: 10% (Portfolio quality, relevant projects, industry certifications)
- Availability: 5% (Location fit, start date, work preferences)

DETAILED EVALUATION CRITERIA:

1. SKILLS ANALYSIS (40 points):
   - Direct skill overlap with job requirements
   - Skill depth and proficiency level
   - Modern vs outdated technologies
   - Complementary skills that add value
   - Learning ability demonstrated through skill diversity

2. EXPERIENCE ASSESSMENT (30 points):
   - Relevance of past roles to target position
   - Company reputation and industry relevance
   - Career progression and growth trajectory
   - Leadership and responsibility levels
   - Quantifiable achievements and impact

3. EDUCATION EVALUATION (15 points):
   - Degree relevance to field
   - Institution reputation
   - Academic achievements
   - Continuous learning and certifications
   - Specialized training relevant to role

4. PROJECTS & CERTIFICATIONS (10 points):
   - Portfolio quality and complexity
   - Real-world application of skills
   - Innovation and problem-solving demonstrated
   - Industry-recognized certifications
   - Open source contributions or community involvement

5. AVAILABILITY ASSESSMENT (5 points):
   - Location compatibility
   - Work schedule flexibility
   - Start date availability
   - Remote/in-office preferences match
   - Legal work authorization

INSTRUCTIONS FOR COMPREHENSIVE EVALUATION:

For EACH candidate, perform this detailed analysis:

1. **SKILLS BREAKDOWN**: 
   - List exact matching skills from job requirements
   - Identify transferable skills
   - Note skill gaps and their severity
   - Assess skill level based on experience and projects

2. **EXPERIENCE ANALYSIS**:
   - Evaluate relevance of each role
   - Assess career progression
   - Look for red flags (job hopping, gaps)
   - Identify industry expertise

3. **EDUCATION ASSESSMENT**:
   - Degree relevance and quality
   - Continuous learning evidence
   - Academic achievements vs practical skills

4. **PROJECTS PORTFOLIO REVIEW**:
   - Technical complexity and innovation
   - Business impact and user value
   - Code quality indicators (if GitHub available)
   - Design thinking and problem-solving

5. **STRENGTHS IDENTIFICATION**:
   - Top 3-5 specific strengths with examples
   - Unique value propositions
   - Competitive advantages over other candidates

6. **GAPS ANALYSIS**:
   - Critical missing skills for the role
   - Experience gaps that could impact performance
   - Areas requiring training or support
   - Deal-breaker issues if any

7. **OVERALL RECOMMENDATION**:
   - 2-3 sentence recruiter-friendly summary
   - Specific reasons for recommendation
   - Ideal role fit within the organization
   - Interview priority level

8. **FINAL VERDICT**:
   - "Strong Hire" (90-100): Exceptional candidate, immediate interview
   - "Hire" (80-89): Strong candidate, high priority interview
   - "Consider" (60-79): Viable candidate, worth interviewing
   - "Borderline" (<60): Limited fit, interview only if desperate

RESPONSE FORMAT (Provide a comprehensive, human-readable analysis):

**SCREENING SUMMARY**
[Brief overview of the candidate pool and key findings]

**TOP CANDIDATES RANKING**

For each candidate, provide:

**Rank [Number]: [Candidate Name] - [Match Score]% - [Final Verdict]**

**Detailed Analysis:**
- **Skills Match:** [Score]/40 - [Detailed assessment of skills alignment]
- **Experience:** [Score]/30 - [Experience relevance and progression analysis]
- **Education:** [Score]/15 - [Educational background evaluation]
- **Projects & Certifications:** [Score]/10 - [Portfolio and credentials assessment]
- **Availability:** [Score]/5 - [Location and schedule compatibility]

**Key Strengths:**
- [List 3-5 specific strengths with examples]

**Areas for Development:**
- [List 2-3 gaps or areas needing improvement]

**Comprehensive Reasoning:**
[Detailed paragraph explaining WHY this candidate received their score, including specific examples from their profile, red flags (if any), and overall fit assessment]

**Recommendation:**
[2-3 sentence recruiter-friendly summary with interview priority]

---

Provide this analysis for the top ${shortlistSize} candidates ranked by match score (highest first). Make the analysis thorough, evidence-based, and easy for recruiters to understand and act upon.

Evaluate ALL ${candidates.length} candidates comprehensively and provide detailed rankings with human-readable analysis for the top ${shortlistSize} candidates.`;
  }

  private parseHumanFriendlyResponse(text: string): { candidates: ScreenedCandidate[], summary: string } {
    const candidates: ScreenedCandidate[] = [];
    let summary = '';

    // Extract summary
    const summaryMatch = text.match(/\*\*SCREENING SUMMARY\*\*([\s\S]*?)(?=\*\*TOP CANDIDATES|\*\*Rank|\*\*|$)/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Extract candidate sections
    const candidateSections = text.split(/\*\*Rank \d+:/);
    
    candidateSections.forEach((section, index) => {
      if (index === 0) return; // Skip first section (before first rank)
      
      const candidate: Partial<ScreenedCandidate> = {
        candidateIndex: index - 1,
        rank: index,
        strengths: [],
        gaps: [],
        scoreBreakdown: { skills: 0, experience: 0, education: 0, projectsAndCerts: 0, availability: 0 }
      };

      // Extract name and score
      const headerMatch = section.match(/([^-\n]+)\s*-\s*(\d+)%?\s*-\s*(.+?)(?=\*\*|$)/);
      if (headerMatch) {
        candidate.name = headerMatch[1].trim();
        candidate.matchScore = parseInt(headerMatch[2]) || 0;
        candidate.finalVerdict = this.parseVerdict(headerMatch[3]);
      }

      // Extract score breakdown
      const skillsMatch = section.match(/\*\*Skills Match:\*\*\s*(\d+)\/40/);
      const experienceMatch = section.match(/\*\*Experience:\*\*\s*(\d+)\/30/);
      const educationMatch = section.match(/\*\*Education:\*\*\s*(\d+)\/15/);
      const projectsMatch = section.match(/\*\*Projects & Certifications:\*\*\s*(\d+)\/10/);
      const availabilityMatch = section.match(/\*\*Availability:\*\*\s*(\d+)\/5/);

      candidate.scoreBreakdown = {
        skills: parseInt(skillsMatch?.[1] ?? '0') || 0,
        experience: parseInt(experienceMatch?.[1] ?? '0') || 0,
        education: parseInt(educationMatch?.[1] ?? '0') || 0,
        projectsAndCerts: parseInt(projectsMatch?.[1] ?? '0') || 0,
        availability: parseInt(availabilityMatch?.[1] ?? '0') || 0
      };

      // Extract strengths
      const strengthsMatch = section.match(/\*\*Key Strengths:\*\*([\s\S]*?)(?=\*\*Areas|\*\*Comprehensive|\*\*Recommendation|$)/i);
      if (strengthsMatch) {
        candidate.strengths = this.extractBulletPoints(strengthsMatch[1]);
      }

      // Extract gaps
      const gapsMatch = section.match(/\*\*Areas for Development:\*\*([\s\S]*?)(?=\*\*Comprehensive|\*\*Recommendation|$)/i);
      if (gapsMatch) {
        candidate.gaps = this.extractBulletPoints(gapsMatch[1]);
      }

      // Extract reasoning
      const reasoningMatch = section.match(/\*\*Comprehensive Reasoning:\*\*([\s\S]*?)(?=\*\*Recommendation|$)/i);
      if (reasoningMatch) {
        candidate.reasoning = reasoningMatch[1].trim();
      }

      // Extract recommendation
      const recommendationMatch = section.match(/\*\*Recommendation:\*\*([\s\S]*?)(?=\*\*|$)/i);
      if (recommendationMatch) {
        candidate.recommendation = recommendationMatch[1].trim();
      }

      candidates.push(candidate as ScreenedCandidate);
    });

    return { candidates, summary };
  }

  private parseVerdict(text: string): "Strong Hire" | "Hire" | "Consider" | "Borderline" {
    const cleanText = text.toLowerCase().trim();
    if (cleanText.includes('strong hire')) return 'Strong Hire';
    if (cleanText.includes('hire')) return 'Hire';
    if (cleanText.includes('consider')) return 'Consider';
    if (cleanText.includes('borderline')) return 'Borderline';
    return 'Consider';
  }

  private extractBulletPoints(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    const bulletPoints: string[] = [];
    
    lines.forEach(line => {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('**')) {
        bulletPoints.push(cleaned);
      }
    });
    
    return bulletPoints;
  }
}

// Export lazy singleton — only instantiated when first used, not at import time
let _instance: AiScreeningService | null = null;
export const aiScreeningService = {
  get instance() {
    if (!_instance) _instance = new AiScreeningService();
    return _instance;
  },
  screenCandidates(...args: Parameters<AiScreeningService['screenCandidates']>) {
    return this.instance.screenCandidates(...args);
  }
};