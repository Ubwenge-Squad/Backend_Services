# Intore Backend API Service

Express + TypeScript REST API powering the Intore recruitment platform with AI-powered candidate screening.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [AI Decision Flow](#ai-decision-flow)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Email & OTP Verification](#email--otp-verification)
- [Project Structure](#project-structure)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Security](#security)
- [Assumptions & Limitations](#assumptions--limitations)
- [Scripts](#scripts)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTORE PLATFORM                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Frontend (Next.js) │◄───────►│  Backend (Express)   │
│   - React UI         │  REST   │  - TypeScript API    │
│   - State Management │  API    │  - Business Logic    │
│   - Auth Flow        │         │  - Auth & Security   │
└──────────────────────┘         └──────────┬───────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │   MongoDB Atlas  │   │  Google Gemini   │   │   Cloudinary     │
         │   - User Data    │   │  - AI Screening  │   │   - File Storage │
         │   - Jobs         │   │  - Embeddings    │   │   - Resume PDFs  │
         │   - Applications │   │  - Chat/Q&A      │   │   - Images       │
         │   - Screening    │   │  - Bias Detection│   │                  │
         └──────────────────┘   └──────────────────┘   └──────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      API LAYER (Express)                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │  Auth    │  │  Jobs    │  │ Screening│  │ Ingestion│       │    │
│  │  │Controller│  │Controller│  │Controller│  │Controller│       │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │    │
│  └───────┼─────────────┼─────────────┼─────────────┼─────────────┘    │
│          │             │             │             │                   │
│  ┌───────┼─────────────┼─────────────┼─────────────┼─────────────┐    │
│  │       │             │             │             │             │    │
│  │  ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐  ┌───▼──────┐      │    │
│  │  │  Auth    │  │  Jobs    │  │ Screening│  │ Ingestion│      │    │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │      │    │
│  │  └──────────┘  └──────────┘  └────┬─────┘  └──────────┘      │    │
│  │                                    │                           │    │
│  │                    ┌───────────────▼───────────────┐           │    │
│  │                    │   AI ORCHESTRATOR             │           │    │
│  │                    │  ┌─────────────────────────┐  │           │    │
│  │                    │  │  Gemini AI Service      │  │           │    │
│  │                    │  │  - Candidate Ranking    │  │           │    │
│  │                    │  │  - Embeddings           │  │           │    │
│  │                    │  │  - Chat/Q&A             │  │           │    │
│  │                    │  │  - Bias Detection       │  │           │    │
│  │                    │  └─────────────────────────┘  │           │    │
│  │                    └─────────────────────────────┘           │    │
│  │                                                               │    │
│  │                      BUSINESS LOGIC LAYER                     │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      DATA ACCESS LAYER                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │  User    │  │  Job     │  │Screening │  │Application│       │    │
│  │  │  Model   │  │  Model   │  │  Model   │  │  Model    │       │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │    │
│  └───────┼─────────────┼─────────────┼─────────────┼─────────────┘    │
│          └─────────────┴─────────────┴─────────────┘                   │
│                              │                                          │
│                    ┌─────────▼─────────┐                                │
│                    │   MongoDB Atlas   │                                │
│                    │   - 20+ Models    │                                │
│                    │   - Indexes       │                                │
│                    │   - Aggregations  │                                │
│                    └───────────────────┘                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. CANDIDATE INGESTION
   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ CSV/Excel│───►│ Parser   │───►│ Validator│───►│ MongoDB  │
   │ PDF/Links│    │ Service  │    │ Service  │    │ Storage  │
   │ Umurava  │    └──────────┘    └──────────┘    └──────────┘
   └──────────┘

2. AI SCREENING FLOW
   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │Candidates│───►│ Normalize│───►│  Gemini  │───►│ Rankings │
   │   Data   │    │   Data   │    │   AI     │    │ + Scores │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                         │
                                         ▼
                                   ┌──────────┐
                                   │  Bias    │
                                   │ Detection│
                                   └──────────┘

3. RECRUITER DECISION FLOW
   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Rankings │───►│ Recruiter│───►│   AI     │───►│  Final   │
   │ + Scores │    │ Review   │    │ Comments │    │  Report  │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## AI Decision Flow

### Screening Pipeline

The AI screening system uses Google Gemini to rank candidates through a multi-stage pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI SCREENING PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────┘

STAGE 1: DATA PREPARATION
┌──────────────────────────────────────────────────────────────────────┐
│ Input: Raw candidate data (CSV, PDF, JSON)                           │
│                                                                       │
│ 1. Parse & Extract                                                   │
│    - CSV/Excel → Structured data                                     │
│    - PDF → Text extraction (Cloudinary)                              │
│    - Umurava JSON → Schema validation                                │
│                                                                       │
│ 2. Normalize                                                         │
│    - Standardize field names                                         │
│    - Extract skills, experience, education                           │
│    - Clean and format data                                           │
│                                                                       │
│ 3. Validate                                                          │
│    - Required fields present                                         │
│    - Data types correct                                              │
│    - Remove duplicates                                               │
│                                                                       │
│ Output: Normalized candidate profiles                                │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
STAGE 2: EMBEDDING GENERATION
┌──────────────────────────────────────────────────────────────────────┐
│ Input: Normalized profiles + Job description                         │
│                                                                       │
│ 1. Text Preparation                                                  │
│    - Combine: name, skills, experience, education                    │
│    - Create searchable text representation                           │
│                                                                       │
│ 2. Generate Embeddings (Gemini)                                      │
│    - Convert text to vector embeddings                               │
│    - Capture semantic meaning                                        │
│    - Enable similarity search                                        │
│                                                                       │
│ 3. Store Embeddings                                                  │
│    - Save to MongoDB for future retrieval                            │
│    - Index for fast similarity search                                │
│                                                                       │
│ Output: Vector embeddings for each candidate                         │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
STAGE 3: AI RANKING (Gemini 1.5 Pro)
┌──────────────────────────────────────────────────────────────────────┐
│ Input: Candidates + Job requirements                                 │
│                                                                       │
│ 1. Prompt Construction                                               │
│    - Job description & requirements                                  │
│    - Candidate profiles (batch of 20)                                │
│    - Evaluation criteria                                             │
│    - Output format specification (JSON)                              │
│                                                                       │
│ 2. Gemini Analysis                                                   │
│    For each candidate:                                               │
│    ├─ Match Score (0-100)                                            │
│    ├─ Recommendation (Shortlist/Consider/Not Selected)               │
│    ├─ Reasoning (why this score?)                                    │
│    ├─ Top 3 Strengths                                                │
│    ├─ Top 3 Gaps                                                     │
│    └─ Confidence Level (High/Medium/Low)                             │
│                                                                       │
│ 3. Response Parsing                                                  │
│    - Extract JSON from Gemini response                               │
│    - Validate against Zod schema                                     │
│    - Handle parsing errors gracefully                                │
│                                                                       │
│ Output: Ranked candidates with detailed analysis                     │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
STAGE 4: BIAS DETECTION
┌──────────────────────────────────────────────────────────────────────┐
│ Input: Ranked candidates + Screening results                         │
│                                                                       │
│ 1. Pattern Analysis                                                  │
│    - Check for demographic bias                                      │
│    - Analyze score distributions                                     │
│    - Identify suspicious patterns                                    │
│                                                                       │
│ 2. Fairness Metrics                                                  │
│    - Compare scores across groups                                    │
│    - Statistical significance tests                                  │
│    - Flag potential bias indicators                                  │
│                                                                       │
│ 3. Generate Warnings                                                 │
│    - Create human-readable bias warnings                             │
│    - Suggest corrective actions                                      │
│    - Log for audit trail                                             │
│                                                                       │
│ Output: Bias audit report + Warnings                                 │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
STAGE 5: RECRUITER REVIEW
┌──────────────────────────────────────────────────────────────────────┐
│ Input: Ranked candidates + AI analysis                               │
│                                                                       │
│ 1. Present Results                                                   │
│    - Show top N candidates (configurable)                            │
│    - Display scores, strengths, gaps                                 │
│    - Highlight bias warnings                                         │
│                                                                       │
│ 2. Interactive Q&A (Gemini Chat)                                     │
│    - "Who is the best fit?"                                          │
│    - "Compare top 3 candidates"                                      │
│    - "What are the biggest gaps?"                                    │
│    - Context-aware responses                                         │
│                                                                       │
│ 3. Decision Recording                                                │
│    - Recruiter approves/rejects each candidate                       │
│    - AI provides reasoning for each decision                         │
│    - Track decision history                                          │
│                                                                       │
│ Output: Final decisions + AI commentary                              │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
STAGE 6: FINALIZATION
┌──────────────────────────────────────────────────────────────────────┐
│ Input: All decisions + AI analysis                                   │
│                                                                       │
│ 1. Generate Summary                                                  │
│    - Overall screening statistics                                    │
│    - Approved vs rejected counts                                     │
│    - Key insights and patterns                                       │
│                                                                       │
│ 2. Create Report                                                     │
│    - PDF/HTML report generation                                      │
│    - Include all candidate details                                   │
│    - Add recruiter decisions                                         │
│    - Embed AI reasoning                                              │
│                                                                       │
│ 3. Store Results                                                     │
│    - Save to ScreeningSnapshot                                       │
│    - Update application statuses                                     │
│    - Create audit trail                                              │
│                                                                       │
│ Output: Final screening report + Updated database                    │
└──────────────────────────────────────────────────────────────────────┘
```

### AI Models Used

| Model | Purpose | Configuration |
|-------|---------|---------------|
| **Gemini 1.5 Pro** | Candidate ranking, reasoning, Q&A | Temperature: 0.7, Max tokens: 8192 |
| **Gemini Embedding** | Text embeddings for similarity search | Dimension: 768 |

### Prompt Engineering

The system uses carefully crafted prompts to ensure consistent, high-quality AI responses:

1. **Screening Prompt** (`ai/prompts.ts`)
   - Structured JSON output format
   - Clear evaluation criteria
   - Examples for consistency
   - Bias awareness instructions

2. **Chat Prompt** (`ai/prompts.ts`)
   - Context from screening results
   - Conversational tone
   - Factual, evidence-based responses
   - No hallucinations

3. **Bias Detection Prompt**
   - Statistical analysis instructions
   - Pattern recognition guidelines
   - Fairness metrics calculation

---

## Setup

```bash
npm install
cp env.example .env   # fill in all values
npm run dev           # development with hot reload
npm run build         # compile TypeScript
npm start             # run compiled output
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Server port (default: `4000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars) |
| `CORS_ORIGIN` | Yes | Allowed frontend origin(s), comma-separated |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| **Email Configuration (Gmail SMTP)** | | |
| `SMTP_HOST` | Yes | SMTP host (use `smtp.gmail.com`) |
| `SMTP_PORT` | Yes | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | Yes | Gmail address |
| `SMTP_PASS` | Yes | Gmail App Password (16 characters) |
| `SMTP_FROM_EMAIL` | Yes | Sender email (same as SMTP_USER) |
| `MAIL_FROM_NAME` | No | Sender display name (default: `Intore`) |

---

## Email & OTP Verification

The platform supports **OTP (One-Time Password) verification** for both registration and login flows using Gmail SMTP.

### Features
- 6-digit OTP codes sent via email
- 15-minute expiration
- One-time use per code
- Resend functionality
- Development mode shows codes in API response

### Gmail SMTP Setup

**Quick Setup:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Add credentials to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Intore
```

### Authentication Flow

1. **Registration**: `POST /auth/register` → OTP sent → `POST /auth/verify-registration` → JWT token
2. **Login**: `POST /auth/login` → OTP sent → `POST /auth/verify-login` → JWT token
3. **Resend**: `POST /auth/resend-otp` if code expires

See [`OTP_SETUP.md`](./OTP_SETUP.md) for detailed configuration and usage.

---

## Project Structure

```
src/
├── index.ts                  # App entry point, Express setup
├── routes/
│   └── index.ts              # All route registrations
├── Controllers/
│   ├── auth.controller.ts
│   ├── jobs.controller.ts
│   ├── applicants.controller.ts
│   ├── applications.controller.ts
│   ├── resumes.controller.ts
│   ├── bias.controller.ts
│   └── ingestion.controller.ts
├── models/                   # 20 Mongoose models
├── middlewares/
│   ├── auth.ts               # requireAuth, requireRole
│   └── core.ts               # Error handling, request timing
├── ai/
│   ├── gemini.ts             # GeminiAiService
│   ├── orchestrator.ts       # ScreeningOrchestrator
│   ├── prompts.ts            # Prompt builders
│   ├── normalized.ts         # Candidate data normalization
│   ├── embeddings.ts         # Text embeddings
│   ├── types.ts              # Zod schemas for AI output
│   └── retrievers/
│       ├── mongoRetriever.ts
│       └── sqliteRetriever.ts
├── services/
│   ├── cloudinary.ts         # File upload service
│   ├── mailer.ts             # Email sending
│   └── verification.ts       # Verification code management
├── infrastructure/
│   └── mongo.ts              # MongoDB connection
└── utils/
    └── pagination.ts         # Pagination helpers
```

---

## Authentication

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are issued on login and email verification. They expire after **7 days**.

### Roles

| Role | Access |
|---|---|
| `recruiter` | Jobs (own), screening, ingestion, bias audits |
| `applicant` | Applications, own profile |
| `admin` | All resources |

---

## API Endpoints

See [`API.md`](./API.md) for the full reference.

---

## Security

- **Helmet** — sets secure HTTP headers
- **Rate limiting** — 100 req/min (production), 300 req/min (development)
- **CORS** — configurable via `CORS_ORIGIN`
- **JWT** — HS256, 7-day expiry
- **bcrypt** — password hashing (10 salt rounds)
- **OTP verification** — 6-digit codes for registration and login
- **Email verification** — required before account activation

---

## Assumptions & Limitations

### Technical Assumptions

1. **MongoDB Availability**
   - MongoDB Atlas or local MongoDB instance is always accessible
   - Network connectivity is stable for cloud deployments
   - Database has sufficient storage for candidate data and embeddings

2. **Google Gemini API**
   - API key is valid and has sufficient quota
   - API endpoints are available and responsive
   - Rate limits are not exceeded during batch processing
   - Gemini 1.5 Pro model remains available

3. **Cloudinary Service**
   - Account has sufficient storage and bandwidth
   - PDF text extraction service is functional
   - File upload limits are not exceeded

4. **Gmail SMTP**
   - Gmail account has 2FA enabled
   - App Password is correctly configured
   - Daily sending limits (500 emails/day for free accounts) are not exceeded
   - SMTP service is available

5. **Network & Infrastructure**
   - Backend server has stable internet connection
   - DNS resolution works correctly
   - Firewall rules allow outbound HTTPS connections
   - Server has sufficient memory for concurrent requests

### Data Assumptions

1. **Candidate Data Format**
   - CSV/Excel files follow expected column structure
   - PDF resumes are text-based (not scanned images)
   - Umurava JSON follows the defined schema
   - Required fields (name, email, skills) are present

2. **Data Quality**
   - Candidate information is accurate and up-to-date
   - Skills are properly formatted and recognizable
   - Experience data includes relevant details
   - Education information is complete

3. **Job Descriptions**
   - Job requirements are clearly defined
   - Required skills are explicitly listed
   - Experience requirements are quantifiable
   - Job descriptions are in English or supported languages

4. **Resume Content**
   - Resumes contain structured information
   - Text is extractable from PDF files
   - Content is relevant to the job position
   - No malicious content in uploaded files

### Performance Limitations

1. **Batch Processing**
   - Maximum 100 candidates per screening run (recommended)
   - Larger batches may cause timeouts or memory issues
   - Processing time: ~2-5 seconds per candidate
   - Concurrent screening runs limited to 5 per recruiter

2. **API Rate Limits**
   - Gemini API: 60 requests per minute (free tier)
   - Cloudinary: 500 transformations per month (free tier)
   - Gmail SMTP: 500 emails per day (free account)
   - Backend API: 100 requests per minute per IP

3. **Response Times**
   - AI screening: 30-120 seconds for 20 candidates
   - Chat responses: 2-5 seconds per query
   - File uploads: Depends on file size and network speed
   - Database queries: <100ms for indexed queries

4. **Storage Limits**
   - MongoDB Atlas free tier: 512MB storage
   - Cloudinary free tier: 25GB storage, 25GB bandwidth/month
   - Resume file size limit: 10MB per file
   - Embedding storage: ~3KB per candidate

### AI Limitations

1. **Accuracy & Reliability**
   - AI rankings are suggestions, not definitive decisions
   - Gemini may occasionally produce inconsistent results
   - Confidence scores are estimates, not guarantees
   - Model may misinterpret ambiguous information

2. **Bias & Fairness**
   - AI may inherit biases from training data
   - Bias detection is probabilistic, not absolute
   - Human review is essential for fair hiring
   - System cannot eliminate all forms of bias

3. **Language Support**
   - Primary language: English
   - Limited support for other languages
   - Translation quality may vary
   - Cultural context may be missed

4. **Hallucinations**
   - AI may generate plausible but incorrect information
   - Always verify critical details manually
   - Cross-reference AI suggestions with source data
   - Use AI as a tool, not a replacement for human judgment

5. **Context Understanding**
   - AI has limited understanding of company culture
   - Cannot assess soft skills from resumes alone
   - May miss nuanced qualifications
   - Cannot evaluate candidate personality or fit

### Scalability Considerations

1. **Horizontal Scaling**
   - Single-instance deployment by default
   - Load balancing requires additional configuration
   - Session management needs Redis for multi-instance
   - File uploads should use CDN for high traffic

2. **Database Scaling**
   - MongoDB sharding not configured by default
   - Indexes required for large datasets
   - Aggregation queries may slow down with millions of records
   - Regular cleanup of old data recommended

3. **Cost Scaling**
   - Gemini API costs increase with usage
   - Cloudinary costs scale with storage and bandwidth
   - MongoDB Atlas costs increase with data size
   - Consider enterprise plans for high-volume usage

4. **Concurrent Users**
   - Designed for small to medium teams (10-50 recruiters)
   - May require optimization for 100+ concurrent users
   - WebSocket connections limited by server resources
   - Consider caching for frequently accessed data

### Security Limitations

1. **Authentication**
   - JWT tokens stored in localStorage (XSS risk)
   - No refresh token rotation by default
   - Session management is stateless
   - Consider implementing refresh tokens for production

2. **Data Privacy**
   - Candidate data sent to third-party AI service (Gemini)
   - Resume files stored on Cloudinary (third-party)
   - Ensure compliance with GDPR, CCPA, and local laws
   - Implement data retention policies

3. **Input Validation**
   - File upload validation is basic
   - No virus scanning on uploaded files
   - Limited protection against malicious PDFs
   - Consider adding antivirus integration

4. **Audit Trail**
   - Basic audit logging implemented
   - No comprehensive security event monitoring
   - Limited forensic capabilities
   - Consider adding SIEM integration for production

### Known Issues & Workarounds

1. **Large File Processing**
   - Issue: PDFs >10MB may timeout
   - Workaround: Split large files or compress before upload

2. **Concurrent Screening**
   - Issue: Multiple simultaneous screenings may hit rate limits
   - Workaround: Queue system or sequential processing

3. **Email Delivery**
   - Issue: Gmail may mark emails as spam
   - Workaround: Configure SPF, DKIM, DMARC records

4. **AI Response Parsing**
   - Issue: Gemini occasionally returns malformed JSON
   - Workaround: Retry logic with exponential backoff

### Recommendations for Production

1. **Monitoring & Observability**
   - Implement application performance monitoring (APM)
   - Set up error tracking (e.g., Sentry)
   - Configure log aggregation (e.g., ELK stack)
   - Monitor API rate limits and quotas

2. **Backup & Recovery**
   - Regular MongoDB backups (daily recommended)
   - Test restore procedures periodically
   - Implement disaster recovery plan
   - Store backups in separate geographic region

3. **Security Hardening**
   - Enable HTTPS with valid SSL certificates
   - Implement rate limiting per user, not just per IP
   - Add request signing for sensitive operations
   - Regular security audits and penetration testing

4. **Performance Optimization**
   - Implement Redis caching for frequent queries
   - Use CDN for static assets
   - Optimize database indexes
   - Consider read replicas for MongoDB

5. **Compliance**
   - Document data processing activities
   - Implement data deletion workflows
   - Add consent management
   - Regular compliance audits

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run check` | TypeScript type check only |

---

## Swagger / OpenAPI

Interactive API docs available at `http://backend_api:4000/docs` when the server is running.

The spec file is at `openapi.yaml` in the project root.
