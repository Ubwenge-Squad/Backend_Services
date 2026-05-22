import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { NotificationModel } from '../models/Notification.model';
import { sendSuccess, sendError } from '../utils/response';

export const NotificationsController = {
	async list(req: Request, res: Response): Promise<Response> {
		const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
		const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
		const skip = (page - 1) * limit;
		const filter: Record<string, unknown> = { user: req.user!.id };
		if (req.query.unread === 'true') filter.isRead = false;

		const [notifications, total] = await Promise.all([
			NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			NotificationModel.countDocuments(filter),
		]);
		return sendSuccess(res, {
			notifications,
			total,
			page,
			limit,
			unread: await NotificationModel.countDocuments({ user: req.user!.id, isRead: false }),
		});
	},

	async markRead(req: Request, res: Response): Promise<Response> {
		const { ids, all } = req.body;
		if (all) {
			await NotificationModel.updateMany({ user: req.user!.id, isRead: false }, { isRead: true });
			return sendSuccess(res, { ok: true });
		}
		if (!Array.isArray(ids) || ids.length === 0) {
			return sendError(res, 400, 'ids array or all flag required', 'BAD_REQUEST');
		}
		const validIds = ids.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
		await NotificationModel.updateMany({ _id: { $in: validIds }, user: req.user!.id }, { isRead: true });
		return sendSuccess(res, { ok: true });
	},

	async getUnreadCount(req: Request, res: Response): Promise<Response> {
		const count = await NotificationModel.countDocuments({ user: req.user!.id, isRead: false });
		return sendSuccess(res, { count });
	},
};
