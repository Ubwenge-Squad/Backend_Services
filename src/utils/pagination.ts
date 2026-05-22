import { Request } from 'express';

export interface PaginationOptions {
	page: number;
	limit: number;
	skip: number;
}

export function parsePagination(req: Request, defaultLimit = 20): PaginationOptions {
	const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), 100);
	const page = Math.max(Number(req.query.page) || 1, 1);
	return { page, limit, skip: (page - 1) * limit };
}

export function toPaginatedResponse<T>(data: T[], page: number, limit: number, total: number) {
	return {
		data,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.max(Math.ceil(total / limit), 1)
		}
	};
}
