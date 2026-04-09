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

export int