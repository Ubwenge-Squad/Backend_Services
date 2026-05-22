import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

interface ValidationSchemas {
	body?: ZodSchema;
	query?: ZodSchema;
	params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			if (schemas.body) {
				req.body = schemas.body.parse(req.body);
			}
			if (schemas.query) {
				req.query = schemas.query.parse(req.query) as any;
			}
			if (schemas.params) {
				req.params = schemas.params.parse(req.params) as any;
			}
			next();
		} catch (err) {
			if (err instanceof ZodError) {
				const details = err.issues.map((issue: any) => ({
					path: (issue.path as (string | number)[]).join('.'),
					message: String(issue.message),
				}));
				sendError(res, 422, 'Validation failed', 'VALIDATION_ERROR', details);
				return;
			}
			next(err);
		}
	};
}
