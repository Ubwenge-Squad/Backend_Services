import { Express, Request, Response, NextFunction } from 'express';

export function registerCoreMiddlewares(app: Express): void {
	// Simple request id and timing
	app.use((req: Request, _res: Response, next: NextFunction) => {
		(req as any).reqStart = Date.now();
		next();
	});

	// Global error handler placeholder
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		console.error(err);
		const isProduction = process.env.NODE_ENV === 'production';
		const message = isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error';
		res.status(err.status || 500).json({ message });
	});
}

