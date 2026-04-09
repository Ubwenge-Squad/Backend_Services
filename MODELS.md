# Data Models

All models use Mongoose with MongoDB. Timestamps (`createdAt`, `updatedAt`) are enabled on all schemas unless noted.

---

## User

Collection: `users`

| Field | Type | Description |
|---|---|---|
| `email` | String (unique) | Login email |
| `passwordHash` | String | bcrypt hash |
| `role` | `applicant` \| `recruiter` \| `admin` | User role |
| `fullName` | String | Display name |
| `avatarUrl` | String? | Profile picture URL |
| `phoneNumber` | String? | Phone number |
| `isActive` | Boolean | Account active flag |
| `emailVerified` | Boolean | Email verification status |
| `lastLoginAt` | Date? | Last login timestamp |
| `deletedAt` | Date? | Soft delete timestamp |
| `scheduledPurgeAt` | Date? | GDPR purge date (deletedAt + 90 days) |

---

## RecruiterProfile

Collection: `recruiterprofiles`

| Field | Type | Description |
|---|---|---|
| `user` | ObjectId → User | Owning user |
| `companyName` | String | Company name |
| `companyWebsite` | String? | Company website |
| `industry` | String? | Industry sector |
| `companySize` | String? | Size range |
| `logoUrl` | String? | Company logo |

---

## ApplicantProfile

Collection: `applicantprofiles`

| Field | Type | Description |
|---|---|---|
| `user` | ObjectId → User | Owning user |
| `headline` | String? | Professional headline |
| `skills` | String[] | Skill list |
| `experienceYears` | Number? | Total years of experience |
| `currentRole` | String? | Current job title |
| `linkedinUrl` | String? | LinkedIn profile |
| `portfolioUrl` | String? | Portfolio URL |
| `resumeUrl` | String? | Uploaded resume URL |

---

## Job

Collection: `jobs`

| Field | Type | Description |
|---|---|---|
| `recruiter` | ObjectId → RecruiterProfile | Owner |
| `title` | String | Job title |
| `description` | String | Full description |
| `requirements` | String? | Requirements text |
| `responsibilities` | String? | Responsibilities text |
| `requiredSkills` | String[] | Must-have skills |
| `niceToHaveSkills` | String[] | Optional skills |
| `minYearsExperience` | Number? | Minimum experience |
| `requiresDegree` | Boolean | Degree required |
| `degreeDetails` | String? | Degree level |
| `location` | String? | Job location |
| `isRemote` | Boolean | Remote flag |
| `employmentType` | String? | Full-time / Part-time / Contract |
| `salaryMin` | Number? | Minimum salary |
| `salaryMax` | Number? | Maximum salary |
| `currency` | String | Currency (default: `RWF`) |
| `status` | `draft` \| `active` \| `paused` \| `closed` \| `archived` | Job status |
| `publishedAt` | Date? | When activated |
| `closedAt` | Date? | When closed |
| `screeningBatchSize` | Number | Max candidates per screening run (default: 20) |
| `aiAssisted` | Boolean | AI screening enabled |
| `teamTraits` | String[] | Desired team traits |

---

## Application

Collection: `applications`

| Field | Type | Description |
|---|---|---|
| `job` | ObjectId → Job | Applied job |
| `applicant` | ObjectId → ApplicantProfile | Applicant |
| `resume` | ObjectId → Resume? | Attached resume |
| `status` | enum | `submitted` → `screening` → `shortlisted` → `interviewed` → `offered` → `hired` / `rejected` / `withdrawn` |
| `coverLetter` | String? | Cover letter text |
| `recruiterNotes` | String? | Internal notes |
| `submittedAt` | Date | Submission time |
| `firstResponseMinutes` | Number? | Time to first response |

Unique index: `(job, applicant)`

---

## Resume

Collection: `resumes`

| Field | Type | Description |
|---|---|---|
| `applicant` | ObjectId → ApplicantProfile | Owner |
| `fileUrl` | String | Cloudinary URL |
| `fileName` | String | Original filename |
| `parsedContent` | Mixed? | AI-parsed resume data |
| `parsedAt` | Date? | When parsed |

---

## ScreeningRun

Collection: `screeningruns`

| Field | Type | Description |
|---|---|---|
| `job` | ObjectId → Job | Target job |
| `triggeredBy` | String | User ID who triggered |
| `status` | `pending` \| `processing` \| `completed` \| `failed` | Run status |
| `batchSize` | Number | Candidates in this run |
| `totalCandidates` | Number | Total candidates available |
| `processedCount` | Number | Candidates processed |
| `modelVersion` | String | Gemini model used |
| `startedAt` | Date? | Start time |
| `completedAt` | Date? | End time |
| `errorMessage` | String? | Error if failed |

---

## ScreeningResult

Collection: `screeningresults`

| Field | Type | Description |
|---|---|---|
| `screeningRun` | ObjectId → ScreeningRun | Parent run |
| `application` | ObjectId → Application | Candidate application |
| `candidateName` | String? | Candidate display name |
| `rankPosition` | Number? | Rank in this run |
| `fitScore` | Number | 0–100 match score |
| `confidenceLevel` | `high` \| `medium` \| `low` | AI confidence |
| `aiReasoning` | String | Gemini explanation |
| `recommendation` | String? | `Shortlist` / `Consider` / `Not selected` |
| `strengths` | String[] | Key strengths |
| `gaps` | String[] | Key gaps |
| `biasWarning` | String? | Bias warning text |
| `biasCategory` | enum? | Type of bias detected |
| `biasWarningDismissed` | Boolean | Dismissed by recruiter |
| `adjacentRoles` | String[] | Related roles candidate could fit |
| `upskillingPaths` | Object[] | Suggested upskilling paths |
| `weightConfig` | Mixed? | Weights used for this result |

Unique index: `(screeningRun, application)`

---

## ScreeningSnapshot

Collection: `screeningsnapshots`

Stores the latest screening results per job for fast retrieval.

| Field | Type | Description |
|---|---|---|
| `jobId` | ObjectId → Job | Job reference |
| `screeningRun` | ObjectId → ScreeningRun | Latest run |
| `results` | Mixed[] | Sorted ranked results |

---

## SemanticCache

Collection: `semanticcaches`

Caches Gemini screening responses to avoid redundant API calls.

| Field | Type | Description |
|---|---|---|
| `queryHash` | String (unique) | Base64 hash of job + candidates + weights |
| `queryText` | String | Original prompt |
| `responseText` | String | Cached JSON response |
| `modelVersion` | String | Model used |
| `hitCount` | Number | Cache hit counter |
| `expiresAt` | Date | Cache expiry (24 hours) |

---

## VerificationToken

Collection: `verificationtokens`

| Field | Type | Description |
|---|---|---|
| `email` | String | Target email |
| `code` | String | 6-digit code |
| `purpose` | `register` \| `reset_password` | Token purpose |
| `expiresAt` | Date | Expiry (15 minutes) |
| `used` | Boolean | Whether consumed |

---

## BiasAuditLog

Collection: `biasauditlogs`

| Field | Type | Description |
|---|---|---|
| `screeningResult` | ObjectId → ScreeningResult | Related result |
| `biasType` | String | Type of bias detected |
| `description` | String | Explanation |
| `dismissed` | Boolean | Dismissed flag |
| `dismissedBy` | ObjectId → User? | Who dismissed |
| `dismissedAt` | Date? | When dismissed |

---

## ChatSession

Collection: `chatsessions`

| Field | Type | Description |
|---|---|---|
| `recruiter` | ObjectId → User | Session owner |
| `job` | ObjectId → Job? | Job context |
| `messages` | Object[] | `{ role, content, timestamp }` |

---

## Notification

Collection: `notifications`

| Field | Type | Description |
|---|---|---|
| `user` | ObjectId → User | Recipient |
| `type` | String | Notification type |
| `message` | String | Notification text |
| `read` | Boolean | Read status |
| `link` | String? | Action URL |

---

## Interview / Offer / AuditTrail / AgentRun

Additional models for interview scheduling, offer management, audit logging, and AI agent run tracking. See source files in `src/models/` for full schemas.
