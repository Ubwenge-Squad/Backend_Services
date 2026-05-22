import { Request, Response, NextFunction } from 'express';
import { SubscriptionModel } from '../models/Subscription.model';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan.model';
import { sendError } from '../utils/response';

type QuotaCheck = 'screening' | 'job_create' | 'ai_chat' | 'candidate_ingest';

const QUOTA_MAP: Record<QuotaCheck, { usageField: string; quotaField: string; label: string }> = {
	screening: { usageField: 'usage.screeningsUsed', quotaField: 'quotas.screeningsPerMonth', label: 'screenings' },
	job_create: { usageField: null as any, quotaField: 'quotas.activeJobs', label: 'active jobs' },
	ai_chat: { usageField: 'usage.aiChatUsed', quotaField: 'quotas.aiChatPerDay', label: 'AI chat queries' },
	candidate_ingest: { usageField: null as any, quotaField: 'quotas.candidatesPerJob', label: 'candidates per job' },
};

export function checkQuota(resource: QuotaCheck) {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const config = QUOTA_MAP[resource];
			if (!config) {
				next();
				return;
			}

			const sub = await SubscriptionModel.findOne({ user: req.user!.id, status: 'active' }).lean();
			if (!sub) {
				sendError(res, 402, 'No active subscription. Please subscribe to a plan.', 'PAYMENT_REQUIRED');
				return;
			}

			const plan = await SubscriptionPlanModel.findById(sub.plan).lean();
			if (!plan) {
				next();
				return;
			}

			const quota = (plan.quotas as any)[config.quotaField.replace('quotas.', '')];
			if (quota === -1 || quota === undefined) {
				next();
				return;
			}

			if (config.usageField) {
				const used = (sub.usage as any)[config.usageField.replace('usage.', '')] || 0;
				if (used >= quota) {
					sendError(res, 429, `Quota exceeded: ${config.label}. Upgrade your plan for more.`, 'QUOTA_EXCEEDED');
					return;
				}
			}

			next();
		} catch {
			next();
		}
	};
}
