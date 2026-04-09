# Intore Backend — API Service

Express + TypeScript REST API powering the Intore recruitment platform.

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
| `SMTP_HOST` | No | SMTP host (default: `smtp.gmail.com`) |
| `SMTP_PORT` | No | SMTP port (default: `465`) |
| `SMTP_SECURE` | No | Use TLS (`true`/`false`) |
| `SMTP_USER` | No | SMTP username / Gmail address |
| `SMTP_PASS` | No | Gmail App Password |
| `MAIL_FROM_NAME` | No | Sender display name |
| `MAIL_FROM_EMAIL` | No | Sender email address |

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
- **Email verification** — required before first login

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

Interactive API docs available at `http://localhost:4000/docs` when the server is running.

The spec file is at `openapi.yaml` in the project root.
