# AI & Screening System

Intore uses Google Gemini 1.5 Pro for candidate screening, ranking, and recruiter Q&A.

---

## Architecture Overview

```
Recruiter triggers screening
        │
        ▼
ScreeningOrchestrator.runForJob()
        │
        ├── getJobWithApplicants()     ← MongoDB retriever
        │         │
        │         └── Fetches job + normalized applicant profiles
        │
        ├── buildMultiCandidatePrompt()  ← Prompt builder
        │         │
        │         └── Constructs system prompt with job, candidates, weights
        │
        ├── SemanticCache check         ← Skip Gemini if cached
        │
        ├── GeminiAiService.evaluateWithPrompt()
        │         │
        │         └── Calls Gemini 1.5 Pro → extracts JSON
        │
        ├── RankedOutputSchema.parse()  ← Zod validation
        │
        ├── ScreeningResultModel.create() × N  ← Persist results
        │
        ├── ScreeningSnapshotModel.updateOne()  ← Latest snapshot
        │
        └── SemanticCache.updateOne()   ← Cache for 24h
```

---

## GeminiAiService

`src/ai/gemini.ts`

Wraps the `@google/generative-ai` SDK.

### Methods

#### `evaluateWithPrompt(prompt: string): Promise<unknown>`
Sends a prompt to Gemini and returns parsed JSON. Handles:
- Direct JSON response
- Fenced code block extraction (` ```json ... ``` `)
- First `{...}` block extraction as fallback

#### `answerWithPrompt(prompt: string): Promise<string>`
Sends a prompt and returns the raw text response. Used for recruiter Q&A.

#### `evaluateCandidates(job, candidates): Promise<unknown>`
Convenience method that builds the prompt internally.

---

## ScreeningOrchestrator

`src/ai/orchestrator.ts`

Manages the full screening lifecycle for a job.

### `runForJob(jobId, triggeredBy, opts?)`

**Options**
```typescript
{
  model?: string;           // default: 'gemini-1.5-pro'
  topK?: number;            // candidates to return (default: 20)
  weightConfig?: {
    skills: number;         // default: 0.4
    experience: number;     // default: 0.3
    education: number;      // default: 0.1
    relevance: number;      // default: 0.2
  };
  useCache?: boolean;       // default: true
}
```

**Flow**
1. Fetch job + applicants from MongoDB
2. Build prompt with weights and topK
3. Check semantic cache (base64 hash of job + applicants + weights)
4. Create `ScreeningRun` record with status `processing`
5. Call Gemini (or use cached response)
6. Validate output with Zod `RankedOutputSchema`
7. Persist `ScreeningResult` for each ranked candidate
8. Upsert `ScreeningSnapshot` for the job
9. Backfill semantic cache (expires 24h)
10. Update `ScreeningRun` to `completed`

---

## Prompt Design

`src/ai/prompts.ts`

### Screening Prompt (`buildMultiCandidatePrompt`)

The system prompt instructs Gemini to:
- Evaluate all candidates **relative to each other** in one pass (not independently)
- Score 0–100 based on configurable weights
- Provide recruiter-friendly reasoning mentioning role relevance, strongest evidence, and major risks
- Give explicit recommendations: `"Shortlist"`, `"Consider"`, or `"Not selected"`
- Return **strict JSON only** — no markdown, no prose

**Output schema**
```json
[
  {
    "rank": 1,
    "name": "Candidate Name",
    "score": 94,
    "strengths": ["React", "TypeScript"],
    "gaps": ["AWS"],
    "reason": "Strong frontend skills with 5+ years...",
    "recommendation": "Shortlist",
    "applicationId": "..."
  }
]
```

### Q&A Prompt (`buildRecruiterQaPrompt`)

Provides Gemini with:
- Full job details
- Latest screening results
- Normalized candidate profiles
- The recruiter's question

Instructs Gemini to answer in plain, recruiter-friendly language using only the provided context.

---

## Semantic Caching

Cache key = base64 of `{ jobId, applicantIds[], weightConfig }`.

- Cache hit → skip Gemini call entirely
- Cache miss → call Gemini, store result for 24 hours
- `hitCount` incremented on each cache hit
- Disable with `useCache: false` in orchestrator options

---

## Candidate Normalization

`src/ai/normalized.ts`

Converts raw applicant data (from CSV, Excel, PDF, or Umurava) into a consistent normalized format:

```typescript
{
  name: string;
  skills: string[];
  experience: number;       // years
  education: string;
  projects: string[];
  currentRole?: string;
  linkedinUrl?: string;
}
```

---

## Bias Detection

The `ScreeningResult` model includes bias fields:

| Field | Values |
|---|---|
| `biasWarning` | Warning text if bias detected |
| `biasCategory` | `credential_bias`, `demographic_bias`, `career_gap_bias`, `linguistic_bias`, `other` |
| `biasWarningDismissed` | Whether the recruiter dismissed it |

The frontend displays a dismissible `BiasWarning` component after screening completes.

---

## Recruiter Q&A (General Context)

When `jobId` is `"general"` or omitted in `/screening/ask`:

1. Find the most recent `ScreeningSnapshot` across all jobs
2. Use that snapshot's job + candidates as context
3. If no snapshots exist, Gemini answers as a general recruiter assistant

This powers the floating AI chat FAB on all dashboard pages.

---

## Zod Schemas

`src/ai/types.ts`

- `RankedOutputSchema` — validates Gemini's ranked candidate array
- `WeightConfigSchema` — validates and normalizes weight configuration

---

## Model

Default model: `gemini-1.5-pro`

Can be overridden per orchestrator instance or per request via `opts.model`.
