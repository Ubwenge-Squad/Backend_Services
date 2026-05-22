export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly details?: unknown;

	constructor(statusCode: number, message: string, code?: string, details?: unknown) {
		super(message);
		this.name = 'AppError';
		this.statusCode = statusCode;
		this.code = code || getDefaultCode(statusCode);
		this.details = details;
		Error.captureStackTrace(this, this.constructor);
	}
}

function getDefaultCode(status: number): string {
	if (status >= 400 && status < 500) {
		switch (status) {
			case 400: return 'BAD_REQUEST';
			case 401: return 'UNAUTHORIZED';
			case 403: return 'FORBIDDEN';
			case 404: return 'NOT_FOUND';
			case 409: return 'CONFLICT';
			case 422: return 'VALIDATION_ERROR';
			case 429: return 'RATE_LIMITED';
			default: return 'CLIENT_ERROR';
		}
	}
	return 'INTERNAL_ERROR';
}
