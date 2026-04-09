# API Reference

Base URL: `http://localhost:4000`

All protected endpoints require `Authorization: Bearer <token>`.

---

## Authentication

### POST /auth/register
Register a new recruiter account.

**Body**
```json
{
  "email": "recruiter@example.com",
  "password": "SecurePass123!",
  "fullName": "Claudine Uwimana",
  "phoneNumber": "+250788000000",
  "role": "recruiter",
  "companyName": "Acme Corp"
}
```

**Response 201**
```json
{
  "message": "User created. Verification required.",
  "verificationRequired": true,
  "email": "recruiter@example.com",
  "devCode": "123456"   // only in non-production
}
```

---

### POST /auth/verify
Verify email with the 6-digit code.

**Body**
```json
{ "email": "recruiter@example.com", "code": "123456" }
```

**Response 200**
```json
{
  "verified": true,
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "recruiter", "fullName": "..." }
}
```

---

### POST /auth/login
Login with email and password.

**Body**
```json
{ "email": "recruiter@example.com", "password": "SecurePass123!" }
```

**Response 200**
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "recruiter", "fullName": "..." }
}
```

---

### POST /auth/resend-code
Resend verification code.

**Body**
```json
{ "email": "recruiter@example.com", "purpose": "register" }
```

---

### GET /auth/me
🔒 Returns the authenticated user's payload from the JWT.

---

## Jobs

All job endpoints require `recruiter` or `admin` role.  
List and getById are scoped to the authenticated recruiter's own jobs.

### GET /jobs
List jobs owned by the authenticated recruiter.

**Query params**: `page`, `limit`, `status`

**Response 200**
```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 5,
  "totalPages": 1
}
```

---

### POST /jobs
Create a new job.

**Body**
```json
{
  "title": "Senior Frontend Developer",
  "description": "...",
  "requiredSkills": ["React", "TypeScript"],
  "niceToHaveSkills": ["GraphQL"],
  "location": "Kigali, Rwanda",
  "isRemote": false,
  "employmentType": "Full-time",
  "minYearsExperience": 3,
  "requiresDegree": true,
  "degreeDetails": "Bachelor's",
  "screeningBatchSize": 20,
  "aiAssisted": true,
  "status": "draft"
}
```

---

### GET /jobs/:jobId
Get a single job by ID. Returns 403 if the job doesn't belong to the requester.

---

### PATCH /jobs/:jobId
Update a job. Ownership enforced.

---

### POST /jobs/:jobId/activate
Publish a job (sets status to `active`).

---

### POST /jobs/:jobId/close
Close a job (sets status to `closed`).

---

## Applicants

### GET /applicants
🔒 `recruiter` | `admin` — List all applicant profiles.

### POST /applicants
🔒 Create an applicant profile.

### GET /applicants/:applicantId
🔒 Get a single applicant profile.

### PATCH /applicants/:applicantId
🔒 Update an applicant profile.

---

## Resumes

### POST /resumes
🔒 Upload a resume file (multipart/form-data, field: `file`, max 10MB).

### GET /resumes/:resumeId
🔒 Get resume metadata.

### POST /resumes/:resumeId/parse
🔒 `recruiter` | `admin` — Parse resume content with AI.

---

## Applications

### GET /applications
🔒 List applications (filtered by job or applicant depending on role).

### POST /applications
🔒 Submit an application.

**Body**
```json
{
  "job": "<jobId>",
  "applicant": "<applicantProfileId>",
  "resume": "<resumeId>",
  "coverLetter": "..."
}
```

### PATCH /applications/:applicationId
🔒 Update application status or recruiter notes.

---

## Screening

### POST /screening/run
🔒 Run AI screening for a job using Gemini.

**Body**
```json
{
  "jobId": "<jobId>",
  "topK": 10,
  "useCache": true,
  "weightConfig": {
    "skills": 0.4,
    "experience": 0.3,
    "education": 0.1,
    "relevance": 0.2
  }
}
```

**Response 200**
```json
{
  "jobId": "...",
  "screeningRunId": "...",
  "results": [
    {
      "rank": 1,
      "name": "Amara Uwimana",
      "score": 94,
      "strengths": ["React", "TypeScript"],
      "gaps": ["AWS"],
      "reason": "Strong frontend skills with 5+ years...",
      "recommendation": "Shortlist",
      "applicationId": "..."
    }
  ]
}
```

---

### POST /screening/ask
🔒 Ask Gemini a question about screening results.

**Body**
```json
{
  "jobId": "<jobId>",
  "question": "Who is the best fit and why?"
}
```

If `jobId` is `"general"` or omitted, uses the most recent screening snapshot.

**Response 200**
```json
{ "answer": "Based on the screening results, Amara Uwimana..." }
```

---

### GET /screening/candidates
🔒 Get normalized candidate profiles for a job.

**Query**: `jobId=<jobId>`

---

### GET /screening-results
🔒 Get the latest screening snapshot for a job.

**Query**: `jobId=<jobId>&top=20`

---

### GET /screening-runs/:screeningRunId
🔒 Get a screening run by ID.

### GET /screening-runs/:screeningRunId/results
🔒 Get all results for a screening run.

---

## Bias Audits

### GET /bias-audits
🔒 `recruiter` | `admin` — List bias audit logs.

### POST /bias-audits/:biasAuditId/dismiss
🔒 `recruiter` | `admin` — Dismiss a bias warning.

---

## Ingestion

### POST /ingestion/csv
🔒 `recruiter` | `admin` — Upload candidates via CSV or Excel file.

**Form data**: `file` (CSV/XLSX), `jobId`

### POST /ingestion/umurava
🔒 `recruiter` | `admin` — Ingest candidates from Umurava profiles.

**Body**
```json
{ "jobId": "<jobId>", "profiles": [...] }
```

---

## Health

### GET /health
Public. Returns `{ "status": "ok" }`.

---

## Error Responses

All errors follow this shape:

```json
{ "message": "Human-readable error description" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Forbidden (wrong role or not owner) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Internal server error |
