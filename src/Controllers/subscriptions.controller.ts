import { Request, Response } from 'express';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan.model';
import { SubscriptionModel } from '../models/Subscription.model';
import { PaymentModel } from '../models/Payment.model';
import { sendSuccess, sendError } from '../utils/response';

export const SubscriptionsController = {
	async listPlans(_req: Request, res: Response): Promise<Response> {
		const plans = await SubscriptionPlanModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
		return sendSuccess(res, plans);
	},

	async getMySubscription(req: Request, res: Response): Promise<Response> {
		const sub = await SubscriptionModel.findOne({ user: req.user!.id }).populate('plan').lean();
		return sendSuccess(res, sub || null);
	},

	async subscribe(req: Request, res: Response): Promise<Response> {
		const { planCode, paymentMethod, phone } = req.body;
		const plan = await SubscriptionPlanModel.findOne({ code: planCode, isActive: true }).lean();
		if (!plan) {
			return sendError(res, 400, 'Invalid plan code', 'BAD_REQUEST');
		}

		const existing = await SubscriptionModel.findOne({ user: req.user!.id });
		if (existing && existing.status === 'active') {
			return sendError(res, 409, 'Already on an active plan. Cancel first to switch.', 'CONFLICT');
		}

		const now = new Date();
		const periodEnd = new Date(now);
		periodEnd.setMonth(periodEnd.getMonth() + 1);

		const sub = await SubscriptionModel.findOneAndUpdate(
			{ user: req.user!.id },
			{
				user: req.user!.id,
				plan: plan._id,
				status: 'active',
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentMethod: paymentMethod || 'card',
				paymentPhone: phone,
				autoRenew: true,
				usage: { screeningsUsed: 0, aiChatUsed: 0 },
			},
			{ upsert: true, new: true }
		);

		if (plan.price > 0) {
			await PaymentModel.create({
				user: req.user!.id,
				subscription: sub._id,
				amount: plan.price,
				currency: plan.currency,
				method: paymentMethod || 'card',
				phone,
				status: 'completed',
				description: `Subscription: ${plan.name} (${plan.interval})`,
				paidAt: now,
			});
		}

		return sendSuccess(res, sub, 201);
	},

	async cancelSubscription(req: Request, res: Response): Promise<Response> {
		const sub = await SubscriptionModel.findOne({ user: req.user!.id, status: 'active' });
		if (!sub) {
			return sendError(res, 404, 'No active subscription found', 'NOT_FOUND');
		}
		sub.status = 'canceled';
		sub.canceledAt = new Date();
		sub.autoRenew = false;
		await sub.save();
		return sendSuccess(res, { message: 'Subscription canceled. Access continues until period end.' });
	},

	async getUsage(req: Request, res: Response): Promise<Response> {
		const sub = await SubscriptionModel.findOne({ user: req.user!.id }).populate('plan').lean();
		if (!sub || !sub.plan) {
			return sendSuccess(res, { usage: null, quotas: null });
		}
		const plan = sub.plan as any;
		return sendSuccess(res, {
			usage: sub.usage,
			quotas: plan.quotas,
			periodStart: sub.currentPeriodStart,
			periodEnd: sub.currentPeriodEnd,
		});
	},

	async listPayments(req: Request, res: Response): Promise<Response> {
		const payments = await PaymentModel.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
		return sendSuccess(res, payments);
	},
};
