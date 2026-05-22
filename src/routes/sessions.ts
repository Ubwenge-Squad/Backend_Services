import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { DecisionSessionModel } from '../models/DecisionSession.model';
import { ScreeningSnapshotModel } from '../models/ScreeningSnapshot.model';
import { JobModel } from '../models/Job.model';
import { GeminiAiService } from '../ai/gemini';
import { requireAuth } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/core';
import { validate } from '../middlewares/validate';
import { sendSuccess, sendError } from '../utils/response';
import { createSessionSchema, thumbsSchema, messageSchema, confirmSessionSchema, sessionIdParam } from '../utils/validation';

const router = Router();

function getAi() {
	if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
	return new GeminiAiService(process.env.GEMINI_API_KEY, { model: 'gemini-2.5-flash' });
}

// ── GET /api/jobs/:jobId/session — get active/finalised session ───────────────
router.get('/jobs/:jobId/session', requireAuth, asyncHandler(async (req: Request, res: Response) => {
	const session = await DecisionSessionModel.findOne({
		jobId: req.params.jobId,
		recruiterId: req.user!.id,
	}).sort({ startedAt: -1 }).lean();
	if (!session) {
		sendError(res, 404, 'No session found', 'NOT_FOUND');
		return;
	}
	sendSuccess(res, session);
}));

// ── POST /api/sessions — create a new session ─────────────────────────────────
router.post('/', requireAuth, validate({ body: createSessionSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { jobId } = req.body;
	if (!jobId) {
		sendError(res, 400, 'jobId is required', 'BAD_REQUEST');
		return;
	}

	const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
	if (!snapshot?.results?.length) {
		sendError(res, 400, 'Run a screening first before starting a review session.', 'BAD_REQUEST');
		return;
	}

	const existing = await DecisionSessionModel.findOne({ jobId, recruiterId: req.user!.id, status: 'active' }).lean();
	if (existing) {
		sendSuccess(res, existing);
		return;
	}

	const job = await JobModel.findById(jobId).lean();
	const candidates = (snapshot.results as any[]).map((r: any) => ({
		candidateId: r.applicationId || String(r.rank),
		name: r.name || `Candidate #${r.rank}`,
		rank: r.rank,
		overallScore: Math.round(r.score),
		subscores: r.subscores || {},
		strengths: r.strengths || [],
		gaps: r.gaps || [],
		recommendation: r.recommendation || '',
	}));

	const session = await DecisionSessionModel.create({
		jobId,
		recruiterId: req.user!.id,
		status: 'active',
		startedAt: new Date(),
		candidates,
		thumbsLog: [],
		messages: [],
	});

	sendSuccess(res, session, 201);
}));

// ── GET /api/sessions/:id — get full session ──────────────────────────────────
router.get('/:id', requireAuth, validate({ params: sessionIdParam }), asyncHandler(async (req: Request, res: Response) => {
	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id }).lean();
	if (!session) {
		sendError(res, 404, 'Session not found', 'NOT_FOUND');
		return;
	}
	sendSuccess(res, session);
}));

// ── POST /api/sessions/:id/thumbs — thumbs signal + SSE streaming AI response ─
router.post('/:id/thumbs', requireAuth, validate({ params: sessionIdParam, body: thumbsSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { candidateId, signal } = req.body;
	if (!candidateId || !signal) {
		sendError(res, 400, 'candidateId and signal required', 'BAD_REQUEST');
		return;
	}

	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) {
		sendError(res, 404, 'Session not found', 'NOT_FOUND');
		return;
	}

	const existing = session.thumbsLog.findIndex((t: any) => t.candidateId === candidateId);
	if (existing >= 0) session.thumbsLog[existing] = { candidateId, signal, timestamp: new Date() } as any;
	else session.thumbsLog.push({ candidateId, signal, timestamp: new Date() } as any);

	const candidate = session.candidates.find((c: any) => c.candidateId === candidateId);
	const emoji = signal === 'up' ? '👍' : signal === 'down' ? '👎' : '↩️';
	const recruiterMsg = { _id: new mongoose.Types.ObjectId().toString(), role: 'recruiter' as const, content: `${emoji} ${candidate?.name || candidateId}`, timestamp: new Date() };
	session.messages.push(recruiterMsg as any);
	await session.save();

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');

	try {
		const ai = getAi();
		const job = await JobModel.findById(session.jobId).lean();
		const otherCandidates = session.candidates.filter((c: any) => c.candidateId !== candidateId);

		const prompt = signal === 'up'
			? `You are an AI recruitment advisor. The recruiter just gave THUMBS UP to ${candidate?.name} (Rank ${candidate?.rank}, Score ${candidate?.overallScore}/100).\nThumbs history: ${JSON.stringify(session.thumbsLog)}\nCandidate profile: Strengths: ${candidate?.strengths.join(', ')}. Gaps: ${candidate?.gaps.join(', ')}. Recommendation: ${candidate?.recommendation}\nOther candidates: ${JSON.stringify(otherCandidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore })))}\nWrite 2-4 sentences: acknowledge warmly with specific reference to their actual strengths, compare briefly to 1-2 others, end with nudge to continue. No bullet points. No "Great choice!" generically.`
			: signal === 'down'
				? `You are an AI recruitment advisor. The recruiter just gave THUMBS DOWN to ${candidate?.name} (Rank ${candidate?.rank}, Score ${candidate?.overallScore}/100).\nThumbs history: ${JSON.stringify(session.thumbsLog)}\nCandidate gaps: ${candidate?.gaps.join(', ')}\nOther candidates status: ${JSON.stringify(otherCandidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore })))}\nWrite 2-4 sentences: acknowledge without being dismissive, infer WHY based on gaps, name any emerging pattern if 2+ rejections, end with forward nudge. No "Understood" generically.`
				: `The recruiter cleared the signal for ${candidate?.name}. Write 1 sentence acknowledging this warmly.`;

		const aiMsgId = new mongoose.Types.ObjectId().toString();
		let fullContent = '';

		const stream = await ai.streamContent(prompt);
		for await (const chunk of stream) {
			const text = chunk.text();
			if (text) {
				fullContent += text;
				res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
			}
		}

		session.messages.push({ _id: aiMsgId, role: 'ai', content: fullContent, timestamp: new Date(), triggeredBy: signal === 'up' ? 'thumbs_up' : 'thumbs_down', candidatesReferenced: [candidateId] } as any);
		await session.save();

		res.write(`data: ${JSON.stringify({ done: true, messageId: aiMsgId })}\n\n`);
		res.end();
	} catch (err: any) {
		res.write(`data: ${JSON.stringify({ error: err?.message ?? 'AI failed' })}\n\n`);
		res.end();
	}
}));

// ── POST /api/sessions/:id/message — typed message + SSE streaming ────────────
router.post('/:id/message', requireAuth, validate({ params: sessionIdParam, body: messageSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { content } = req.body;
	if (!content) {
		sendError(res, 400, 'content required', 'BAD_REQUEST');
		return;
	}

	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) {
		sendError(res, 404, 'Session not found', 'NOT_FOUND');
		return;
	}

	const recruiterMsg = { _id: new mongoose.Types.ObjectId().toString(), role: 'recruiter' as const, content, timestamp: new Date(), triggeredBy: 'recruiter_message' as const };
	session.messages.push(recruiterMsg as any);
	await session.save();

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');

	try {
		const ai = getAi();
		const job = await JobModel.findById(session.jobId).lean();
		const prevMessages = session.messages.slice(-10).map((m: any) => `${m.role}: ${m.content}`).join('\n');

		const prompt = `You are an AI recruitment advisor for the role of ${(job as any)?.title || 'this position'}.\nShortlist: ${JSON.stringify(session.candidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore, strengths: c.strengths, gaps: c.gaps })))}\nThumbs signals: ${JSON.stringify(session.thumbsLog)}\nRecent conversation: ${prevMessages}\nRecruiter says: "${content}"\nAnswer specifically using actual candidate data. Keep under 150 words unless comparison requested. Natural paragraphs, no bullet points unless 4+ items.`;

		const aiMsgId = new mongoose.Types.ObjectId().toString();
		let fullContent = '';

		const stream = await ai.streamContent(prompt);
		for await (const chunk of stream) {
			const text = chunk.text();
			if (text) {
				fullContent += text;
				res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
			}
		}

		session.messages.push({ _id: aiMsgId, role: 'ai', content: fullContent, timestamp: new Date(), triggeredBy: 'recruiter_message' } as any);
		await session.save();

		res.write(`data: ${JSON.stringify({ done: true, messageId: aiMsgId })}\n\n`);
		res.end();
	} catch (err: any) {
		res.write(`data: ${JSON.stringify({ error: err?.message ?? 'AI failed' })}\n\n`);
		res.end();
	}
}));

// ── POST /api/sessions/:id/finalise — generate summary ───────────────────────
router.post('/:id/finalise', requireAuth, validate({ params: sessionIdParam }), asyncHandler(async (req: Request, res: Response) => {
	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) {
		sendError(res, 404, 'Session not found', 'NOT_FOUND');
		return;
	}

	const ai = getAi();
	const job = await JobModel.findById(session.jobId).lean();
	const approved = session.thumbsLog.filter((t: any) => t.signal === 'up').map((t: any) => t.candidateId);
	const rejected = session.thumbsLog.filter((t: any) => t.signal === 'down').map((t: any) => t.candidateId);

	const prompt = `The recruiter is ready to finalise hiring decisions for ${(job as any)?.title || 'this role'}.\nShortlist: ${JSON.stringify(session.candidates)}\nThumbs signals: ${JSON.stringify(session.thumbsLog)}\nWrite a FINALISATION SUMMARY as JSON:\n{\n  "summaryMessage": "friendly prose summary of decisions, 3-4 sentences",\n  "finalDecisions": [\n    { "candidateId": "...", "decision": "approved"|"rejected", "justification": "one specific sentence referencing their actual profile" }\n  ]\n}\nFor approved: reference their strongest skill/experience. For rejected: reference the primary gap. Return ONLY valid JSON.`;

	const response = await ai.answerWithPrompt(prompt);
	let parsed: any;
	try {
		const clean = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		parsed = JSON.parse(clean);
	} catch {
		parsed = { summaryMessage: response, finalDecisions: session.candidates.map((c: any) => ({ candidateId: c.candidateId, decision: approved.includes(c.candidateId) ? 'approved' : 'rejected', justification: '' })) };
	}

	sendSuccess(res, parsed);
}));

// ── POST /api/sessions/:id/confirm — save decisions + mark finalised ──────────
router.post('/:id/confirm', requireAuth, validate({ params: sessionIdParam, body: confirmSessionSchema }), asyncHandler(async (req: Request, res: Response) => {
	const { finalDecisions, summaryMessage, recruiterName } = req.body;
	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) {
		sendError(res, 404, 'Session not found', 'NOT_FOUND');
		return;
	}

	session.finalDecisions = (finalDecisions || []).map((d: any) => ({ ...d, approvedBy: recruiterName || 'Recruiter', timestamp: new Date() }));
	session.status = 'finalised';
	session.finalisedAt = new Date();
	session.pdfReport = { generatedAt: new Date(), downloadUrl: `/api/sessions/${session._id}/report`, summary: summaryMessage || '' };
	await session.save();

	sendSuccess(res, { ok: true, session });
}));

export default router;
