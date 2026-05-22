import { Express, Request, Response } from 'express';
import multer from 'multer';
import { AuthController } from '../Controllers/auth.controller';
import { ApplicantsController } from '../Controllers/applicants.controller';
import { ApplicationsController } from '../Controllers/applications.controller';
import { BiasController } from '../Controllers/bias.controller';
import { IngestionController } from '../Controllers/ingestion.controller';
import { JobsController } from '../Controllers/jobs.controller';
import { ResumesController } from '../Controllers/resumes.controller';
import { SubscriptionsController } from '../Controllers/subscriptions.controller';
import { InterviewsController } from '../Controllers/interviews.controller';
import { OffersController } from '../Controllers/offers.controller';
import { PipelineController } from '../Controllers/pipeline.controller';
import { NotificationsController } from '../Controllers/notifications.controller';
import { AnalyticsController } from '../Controllers/analytics.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/core';
import { validate } from '../middlewares/validate';
import { checkQuota } from '../middlewares/quota';
import { DecisionSessionModel } from '../models/DecisionSession.model';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan.model';
import { SubscriptionModel } from '../models/Subscription.model';
import { PaymentModel } from '../models/Payment.model';
import sessionRoutes from './sessions';
import screeningRoutes from './screening';
import { sendSuccess, sendError } from '../utils/response';
import {
	registerSchema, verifyRegistrationSchema, loginSchema, verifyLoginSchema,
	resendOtpSchema, googleSignInSchema,
	createJobSchema, updateJobSchema, jobIdParam,
	createApplicantSchema, applicantIdParam,
	createApplicationSchema, updateApplicationSchema, applicationIdParam,
	biasAuditIdParam, ingestUmuravaSchema,
	subscribeSchema, scheduleInterviewSchema, updateInterviewSchema, interviewIdParam,
	createOfferSchema, respondOfferSchema, offerIdParam,
	moveCandidateSchema, markReadSchema, paymentWebhookSchema,
} from '../utils/validation';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerRoutes(app: Express): void {
	// Auth
	app.post('/auth/register', validate({ body: registerSchema }), AuthController.register);
	app.post('/auth/verify-registration', validate({ body: verifyRegistrationSchema }), AuthController.verifyRegistration);
	app.post('/auth/login', validate({ body: loginSchema }), AuthController.login);
	app.post('/auth/verify-login', validate({ body: verifyLoginSchema }), AuthController.verifyLogin);
	app.post('/auth/resend-otp', validate({ body: resendOtpSchema }), AuthController.resendOtp);
	app.post('/auth/google', validate({ body: googleSignInSchema }), AuthController.googleSignIn);
	app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
		sendSuccess(res, { user: req.user });
	});
	app.post('/auth/logout', (_req: Request, res: Response) => res.status(204).send());

	// Jobs
	app.get('/jobs', requireAuth, requireRole(['recruiter', 'admin']), JobsController.list);
	app.post('/jobs', requireAuth, requireRole(['recruiter', 'admin']), validate({ body: createJobSchema }), JobsController.create);
	app.get('/jobs/:jobId', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam }), JobsController.getById);
	app.patch('/jobs/:jobId', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam, body: updateJobSchema }), JobsController.update);
	app.delete('/jobs/:jobId', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam }), JobsController.delete);
	app.post('/jobs/:jobId/activate', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam }), JobsController.activate);
	app.post('/jobs/:jobId/close', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam }), JobsController.close);

	// Applicants
	app.get('/applicants', requireAuth, requireRole(['recruiter', 'admin']), ApplicantsController.list);
	app.post('/applicants', requireAuth, validate({ body: createApplicantSchema }), ApplicantsController.create);
	app.get('/applicants/:applicantId', requireAuth, validate({ params: applicantIdParam }), ApplicantsController.getById);
	app.patch('/applicants/:applicantId', requireAuth, validate({ params: applicantIdParam }), ApplicantsController.update);

	// Resumes
	app.post('/resumes', requireAuth, upload.single('file'), ResumesController.create);
	app.get('/resumes/:resumeId', requireAuth, ResumesController.getById);
	app.post('/resumes/:resumeId/parse', requireAuth, requireRole(['recruiter', 'admin']), ResumesController.parse);

	// Applications
	app.get('/applications', requireAuth, ApplicationsController.list);
	app.post('/applications', requireAuth, validate({ body: createApplicationSchema }), ApplicationsController.create);
	app.patch('/applications/:applicationId', requireAuth, validate({ params: applicationIdParam, body: updateApplicationSchema }), ApplicationsController.update);

	// Screening (all screening routes in one place)
	app.use('/screening', screeningRoutes);

	// Decision Sessions (AI conversation)
	app.use('/api/sessions', sessionRoutes);
	app.get('/api/jobs/:jobId/session', requireAuth, asyncHandler(async (req: Request, res: Response) => {
		const session = await DecisionSessionModel.findOne({
			jobId: req.params.jobId,
			recruiterId: req.user!.id
		}).sort({ startedAt: -1 }).lean();
		if (!session) {
			sendError(res, 404, 'No session found', 'NOT_FOUND');
			return;
		}
		sendSuccess(res, session);
	}));

	// Bias
	app.get('/bias-audits', requireAuth, requireRole(['recruiter', 'admin']), BiasController.list);
	app.post('/bias-audits/:biasAuditId/dismiss', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: biasAuditIdParam }), BiasController.dismiss);

	// Ingestion (CSV/XLSX)
	app.post('/ingestion/csv', requireAuth, requireRole(['recruiter', 'admin']), upload.single('file'), IngestionController.ingestCsv);
	app.post('/ingestion/umurava', requireAuth, requireRole(['recruiter', 'admin']), validate({ body: ingestUmuravaSchema }), IngestionController.ingestUmurava);

	// ── Subscription & Billing ──────────────────────────────────────────────────
	app.get('/plans', SubscriptionsController.listPlans);
	app.get('/subscription', requireAuth, SubscriptionsController.getMySubscription);
	app.post('/subscription', requireAuth, validate({ body: subscribeSchema }), SubscriptionsController.subscribe);
	app.delete('/subscription', requireAuth, SubscriptionsController.cancelSubscription);
	app.get('/subscription/usage', requireAuth, SubscriptionsController.getUsage);
	app.get('/payments', requireAuth, SubscriptionsController.listPayments);

	// ── Payment Webhook (called by payment providers) ───────────────────────────
	app.post('/payments/webhook', asyncHandler(async (req: Request, res: Response) => {
		const result = paymentWebhookSchema.safeParse(req.body);
		if (!result.success) {
			sendError(res, 400, 'Invalid webhook payload', 'BAD_REQUEST');
			return;
		}
		const { providerReference, status, amount, phone, metadata } = result.data;
		const payment = await PaymentModel.findOneAndUpdate(
			{ providerReference },
			{ status, paidAt: status === 'completed' ? new Date() : undefined, providerResponse: req.body },
			{ new: true }
		);
		if (!payment) {
			sendError(res, 404, 'Payment not found', 'NOT_FOUND');
			return;
		}
		if (status === 'completed' && payment.subscription) {
			await SubscriptionModel.findByIdAndUpdate(payment.subscription, { status: 'active' });
		}
		sendSuccess(res, { received: true });
	}));

	// ── Pipeline (Kanban) ───────────────────────────────────────────────────────
	app.get('/pipeline/:jobId', requireAuth, requireRole(['recruiter', 'admin']), validate({ params: jobIdParam }), PipelineController.getPipeline);
	app.post('/pipeline/move', requireAuth, requireRole(['recruiter', 'admin']), validate({ body: moveCandidateSchema }), PipelineController.moveCandidate);
	app.get('/pipeline-stages', requireAuth, requireRole(['recruiter', 'admin']), PipelineController.getStages);

	// ── Interviews ──────────────────────────────────────────────────────────────
	app.get('/interviews', requireAuth, InterviewsController.list);
	app.post('/interviews', requireAuth, validate({ body: scheduleInterviewSchema }), InterviewsController.schedule);
	app.get('/interviews/:interviewId', requireAuth, validate({ params: interviewIdParam }), InterviewsController.getById);
	app.patch('/interviews/:interviewId', requireAuth, validate({ params: interviewIdParam, body: updateInterviewSchema }), InterviewsController.update);

	// ── Offers ──────────────────────────────────────────────────────────────────
	app.get('/offers', requireAuth, OffersController.list);
	app.post('/offers', requireAuth, validate({ body: createOfferSchema }), OffersController.create);
	app.post('/offers/:offerId/respond', requireAuth, validate({ params: offerIdParam, body: respondOfferSchema }), OffersController.respond);

	// ── Notifications ───────────────────────────────────────────────────────────
	app.get('/notifications', requireAuth, NotificationsController.list);
	app.post('/notifications/mark-read', requireAuth, validate({ body: markReadSchema }), NotificationsController.markRead);
	app.get('/notifications/unread-count', requireAuth, NotificationsController.getUnreadCount);

	// ── Analytics ───────────────────────────────────────────────────────────────
	app.get('/analytics/recruiter-dashboard', requireAuth, requireRole(['recruiter', 'admin']), AnalyticsController.recruiterDashboard);

	// ── Seed subscription plans ─────────────────────────────────────────────────
	(async function seedPlans() {
		try {
			const count = await SubscriptionPlanModel.countDocuments();
			if (count === 0) {
				const plans = [
					{ name: 'Free', code: 'free', price: 0, sortOrder: 0, quotas: { screeningsPerMonth: 10, activeJobs: 1, candidatesPerJob: 20, aiChatPerDay: 5, teamMembers: 1, whatsAppAccess: false, umuravaSync: false, biasReports: false, apiAccess: false, prioritySupport: false } },
					{ name: 'Growth', code: 'growth', price: 29, sortOrder: 1, quotas: { screeningsPerMonth: 100, activeJobs: 10, candidatesPerJob: 500, aiChatPerDay: 50, teamMembers: 5, whatsAppAccess: true, umuravaSync: true, biasReports: true, apiAccess: false, prioritySupport: false } },
					{ name: 'Enterprise', code: 'enterprise', price: 199, sortOrder: 2, quotas: { screeningsPerMonth: -1, activeJobs: -1, candidatesPerJob: -1, aiChatPerDay: -1, teamMembers: -1, whatsAppAccess: true, umuravaSync: true, biasReports: true, apiAccess: true, prioritySupport: true } },
				];
				for (const plan of plans) {
					await SubscriptionPlanModel.findOneAndUpdate({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
				}
				console.log('  ✅ Seeded subscription plans');
			}
		} catch { /* non-critical */ }
	})();
}
