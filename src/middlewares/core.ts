import { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function registerCoreMiddlewares(app: Express): void {
	// Request timing
	app.use((req: Request, _res: Response, next: NextFunction) => {
		(req as any).reqStart = Date.now();
		next();
	});

	// Response timing logger
	app.use((req: Request, res: Response, next: NextFunction) => {
		const originalEnd = res.end.bind(res);
		res.end = function (this: Response, ...args: any[]) {
			const duration = Date.now() - ((req as any).reqStart || Date.now());
			logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
			return originalEnd(...args);
		} as any;
		next();
	});
}

// Wrapper for async route handlers to avoid try/catch repetition
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}
