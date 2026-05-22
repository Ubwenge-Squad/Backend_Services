import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { OfferModel } from '../models/Offer.model';
import { ApplicationModel } from '../models/Application.model';
import { NotificationModel } from '../models/Notification.model';
import { sendSuccess, sendError } from '../utils/response';

export const OffersController = {
	async list(req: Request, res: Response): Promise<Response> {
		const query: Record<string, unknown> = {};
		if (typeof req.query.application === 'string') query.application = req.query.application;
		const offers = await OfferModel.find(query).sort({ createdAt: -1 }).lean();
		return sendSuccess(res, offers);
	},

	async create(req: Request, res: Response): Promise<Response> {
		const { applicationId, salary, currency, startDate, expiryDate, notes } = req.body;
		if (!applicationId || salary === undefined) {
			return sendError(res, 400, 'applicationId and salary are required', 'BAD_REQUEST');
		}
		const application = await ApplicationModel.findById(applicationId).lean();
		if (!application) {
			return sendError(res, 404, 'Application not found', 'NOT_FOUND');
		}

		const existing = await OfferModel.findOne({ application: applicationId }).lean();
		if (existing) {
			return sendError(res, 409, 'An offer already exists for this application', 'CONFLICT');
		}

		const offer = await OfferModel.create({
			application: applicationId,
			issuedBy: req.user!.id,
			salary,
			currency: currency || 'RWF',
			startDate: startDate ? new Date(startDate) : undefined,
			expiryDate: expiryDate ? new Date(expiryDate) : undefined,
			notes,
		});

		await ApplicationModel.findByIdAndUpdate(applicationId, { status: 'offered' });

		await NotificationModel.create({
			user: application.applicant,
			type: 'offer_received',
			title: 'Offer Received!',
			body: `You have received an offer for your application. Check details in your dashboard.`,
			actionUrl: '/applicant/dashboard',
		});

		return sendSuccess(res, offer, 201);
	},

	async respond(req: Request, res: Response): Promise<Response> {
		const offerId = String(req.params.offerId ?? '');
		if (!mongoose.Types.ObjectId.isValid(offerId)) {
			return sendError(res, 400, 'Invalid offerId', 'BAD_REQUEST');
		}
		const { accept, counterOffer } = req.body;
		if (accept === undefined) {
			return sendError(res, 400, 'accept (boolean) is required', 'BAD_REQUEST');
		}

		const offer = await OfferModel.findById(offerId);
		if (!offer) {
			return sendError(res, 404, 'Offer not found', 'NOT_FOUND');
		}
		if (offer.isAccepted !== undefined) {
			return sendError(res, 400, 'Offer already responded to', 'BAD_REQUEST');
		}

		offer.isAccepted = accept;
		offer.respondedAt = new Date();
		if (counterOffer) {
			offer.counterOffered = true;
			offer.salary = counterOffer;
		}
		await offer.save();

		const status = accept ? 'hired' : 'rejected';
		await ApplicationModel.findByIdAndUpdate(offer.application, { status });

		return sendSuccess(res, offer);
	},
};
