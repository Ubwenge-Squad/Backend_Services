import { Response } from 'express';

export interface ApiSuccess<T = unknown> {
	success: true;
	data: T;
}

export interface ApiError {
	success: false;
	error: {
		message: string;
		code: string;
		details?: unknown;
	};
}

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
	return res.status(status).json({ success: true, data } as ApiSuccess<T>);
}

export function sendError(res: Response, status: number, message: string, code = 'INTERNAL_ERROR', details?: unknown): Response {
	return res.status(status).json({
		success: false,
		error: { message, code, details },
	} as ApiError);
}

export function sendPaginated<T>(
	res: Response,
	data: T[],
	page: number,
	limit: number,
	total: number,
): Response {
	return res.status(200).json({
		success: true,
		data,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.max(Math.ceil(total / limit), 1),
		},
	});
}
