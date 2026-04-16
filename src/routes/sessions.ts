import { Router, Request, Response } from 'express';
import { DecisionSessionModel } from '../models/DecisionSession.model';
import { ScreeningSnapshotModel } from '../models/ScreeningSnapshot.model';
import { JobModel } from '../models/Job.model';
import { GeminiAiService } from '../ai/gemini';
import { requireAuth } from '../middlewares/auth';

const router = Router();

function getAi() {
	if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
	return new GeminiAiService(process.env.GEMINI_API_KEY, { model: 'gemini-2.5-flash' });
}

// ── GET /api/jobs/:jobId/session — get active/finalised session ───────────────
router.get('/jobs/:jobId/session', requireAuth, async (req: Request, res: Response) => {
	try {
		const session = await DecisionSessionModel.findOne({
			jobId: req.params.jobId,
			recruiterId: req.user!.id,
		}).sort({ startedAt: -1 }).lean();
		if (!session) { res.status(404).json({ message: 'No session found' }); return; }
		res.json(session);
	} catch (err: any) {
		res.status(500).json({ message: err?.message ?? 'Failed to get session' });
	}
});

// ── POST /api/sessions — create a new session ─────────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const { jobId } = req.body;
		if (!jobId) { res.status(400).json({ message: 'jobId is required' }); return; }

		const snapshot = await ScreeningSnapshotModel.findOne({ jobId }).lean();
		if (!snapshot?.results?.length) {
			res.status(400).json({ message: 'Run a screening first before starting a review session.' });
			return;
		}

		// Check for existing active session
		const existing = await DecisionSessionModel.findOne({ jobId, recruiterId: req.user!.id, status: 'active' }).lean();
		if (existing) { res.json(existing); return; }

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

		res.status(201).json(session);
	} catch (err: any) {
		res.status(500).json({ message: err?.message ?? 'Failed to create session' });
	}
});

// ── GET /api/sessions/:id — get full session ──────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id }).lean();
		if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
		res.json(session);
	} catch (err: any) {
		res.status(500).json({ message: err?.message ?? 'Failed to get session' });
	}
});

// ── POST /api/sessions/:id/thumbs — thumbs signal + SSE streaming AI response ─
router.post('/:id/thumbs', requireAuth, async (req: Request, res: Response) => {
	const { candidateId, signal } = req.body;
	if (!candidateId || !signal) { res.status(400).json({ message: 'candidateId and signal required' }); return; }

	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

	// Log the thumbs signal
	const existing = session.thumbsLog.findIndex((t: any) => t.candidateId === candidateId);
	if (existing >= 0) session.thumbsLog[existing] = { candidateId, signal, timestamp: new Date() } as any;
	else session.thumbsLog.push({ candidateId, signal, timestamp: new Date() } as any);

	// Add recruiter message
	const candidate = session.candidates.find((c: any) => c.candidateId === candidateId);
	const emoji = signal === 'up' ? '👍' : signal === 'down' ? '👎' : '↩️';
	const recruiterMsg = { _id: new (require('mongoose').Types.ObjectId)().toString(), role: 'recruiter' as const, content: `${emoji} ${candidate?.name || candidateId}`, timestamp: new Date() };
	session.messages.push(recruiterMsg as any);
	await session.save();

	// SSE headers
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('Access-Control-Allow-Origin', '*');

	try {
		const ai = getAi();
		const job = await JobModel.findById(session.jobId).lean();
		const otherCandidates = session.candidates.filter((c: any) => c.candidateId !== candidateId);

		const prompt = signal === 'up'
			? `You are an AI recruitment advisor. The recruiter just gave THUMBS UP to ${candidate?.name} (Rank ${candidate?.rank}, Score ${candidate?.overallScore}/100).
Thumbs history: ${JSON.stringify(session.thumbsLog)}
Candidate profile: Strengths: ${candidate?.strengths.join(', ')}. Gaps: ${candidate?.gaps.join(', ')}. Recommendation: ${candidate?.recommendation}
Other candidates: ${JSON.stringify(otherCandidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore })))}
Write 2-4 sentences: acknowledge warmly with specific reference to their actual strengths, compare briefly to 1-2 others, end with nudge to continue. No bullet points. No "Great choice!" generically.`
			: signal === 'down'
			? `You are an AI recruitment advisor. The recruiter just gave THUMBS DOWN to ${candidate?.name} (Rank ${candidate?.rank}, Score ${candidate?.overallScore}/100).
Thumbs history: ${JSON.stringify(session.thumbsLog)}
Candidate gaps: ${candidate?.gaps.join(', ')}
Other candidates status: ${JSON.stringify(otherCandidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore })))}
Write 2-4 sentences: acknowledge without being dismissive, infer WHY based on gaps, name any emerging pattern if 2+ rejections, end with forward nudge. No "Understood" generically.`
			: `The recruiter cleared the signal for ${candidate?.name}. Write 1 sentence acknowledging this warmly.`;

		const aiMsgId = new (require('mongoose').Types.ObjectId)().toString();
		let fullContent = '';

		const stream = await ai.streamContent(prompt);
		for await (const chunk of stream) {
			const text = chunk.text();
			if (text) {
				fullContent += text;
				res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
			}
		}

		// Save AI message
		session.messages.push({ _id: aiMsgId, role: 'ai', content: fullContent, timestamp: new Date(), triggeredBy: signal === 'up' ? 'thumbs_up' : 'thumbs_down', candidatesReferenced: [candidateId] } as any);
		await session.save();

		res.write(`data: ${JSON.stringify({ done: true, messageId: aiMsgId })}\n\n`);
		res.end();
	} catch (err: any) {
		res.write(`data: ${JSON.stringify({ error: err?.message ?? 'AI failed' })}\n\n`);
		res.end();
	}
});

// ── POST /api/sessions/:id/message — typed message + SSE streaming ────────────
router.post('/:id/message', requireAuth, async (req: Request, res: Response) => {
	const { content } = req.body;
	if (!content) { res.status(400).json({ message: 'content required' }); return; }

	const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
	if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

	const recruiterMsg = { _id: new (require('mongoose').Types.ObjectId)().toString(), role: 'recruiter' as const, content, timestamp: new Date(), triggeredBy: 'recruiter_message' as const };
	session.messages.push(recruiterMsg as any);
	await session.save();

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('Access-Control-Allow-Origin', '*');

	try {
		const ai = getAi();
		const job = await JobModel.findById(session.jobId).lean();
		const prevMessages = session.messages.slice(-10).map((m: any) => `${m.role}: ${m.content}`).join('\n');

		const prompt = `You are an AI recruitment advisor for the role of ${(job as any)?.title || 'this position'}.
Shortlist: ${JSON.stringify(session.candidates.map((c: any) => ({ name: c.name, rank: c.rank, score: c.overallScore, strengths: c.strengths, gaps: c.gaps })))}
Thumbs signals: ${JSON.stringify(session.thumbsLog)}
Recent conversation: ${prevMessages}
Recruiter says: "${content}"
Answer specifically using actual candidate data. Keep under 150 words unless comparison requested. Natural paragraphs, no bullet points unless 4+ items.`;

		const aiMsgId = new (require('mongoose').Types.ObjectId)().toString();
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
});

// ── POST /api/sessions/:id/finalise — generate summary ───────────────────────
router.post('/:id/finalise', requireAuth, async (req: Request, res: Response) => {
	try {
		const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
		if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

		const ai = getAi();
		const job = await JobModel.findById(session.jobId).lean();
		const approved = session.thumbsLog.filter((t: any) => t.signal === 'up').map((t: any) => t.candidateId);
		const rejected = session.thumbsLog.filter((t: any) => t.signal === 'down').map((t: any) => t.candidateId);

		const prompt = `The recruiter is ready to finalise hiring decisions for ${(job as any)?.title || 'this role'}.
Shortlist: ${JSON.stringify(session.candidates)}
Thumbs signals: ${JSON.stringify(session.thumbsLog)}
Write a FINALISATION SUMMARY as JSON:
{
  "summaryMessage": "friendly prose summary of decisions, 3-4 sentences",
  "finalDecisions": [
    { "candidateId": "...", "decision": "approved"|"rejected", "justification": "one specific sentence referencing their actual profile" }
  ]
}
For approved: reference their strongest skill/experience. For rejected: reference the primary gap. Return ONLY valid JSON.`;

		const response = await ai.answerWithPrompt(prompt);
		let parsed: any;
		try {
			const clean = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
			parsed = JSON.parse(clean);
		} catch {
			parsed = { summaryMessage: response, finalDecisions: session.candidates.map((c: any) => ({ candidateId: c.candidateId, decision: approved.includes(c.candidateId) ? 'approved' : 'rejected', justification: '' })) };
		}

		res.json(parsed);
	} catch (err: any) {
		res.status(500).json({ message: err?.message ?? 'Failed to generate summary' });
	}
});

// ── POST /api/sessions/:id/confirm — save decisions + mark finalised ──────────
router.post('/:id/confirm', requireAuth, async (req: Request, res: Response) => {
	try {
		const { finalDecisions, summaryMessage, recruiterName } = req.body;
		const session = await DecisionSessionModel.findOne({ _id: req.params.id, recruiterId: req.user!.id });
		if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

		session.finalDecisions = (finalDecisions || []).map((d: any) => ({ ...d, approvedBy: recruiterName || 'Recruiter', timestamp: new Date() }));
		session.status = 'finalised';
		session.finalisedAt = new Date();
		session.pdfReport = { generatedAt: new Date(), downloadUrl: `/api/sessions/${session._id}/report`, summary: summaryMessage || '' };
		await session.save();

		res.json({ ok: true, session });
	} catch (err: any) {
		res.status(500).json({ message: err?.message ?? 'Failed to confirm' });
	}
});

export default router;
