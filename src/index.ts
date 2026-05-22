import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import mongoose from 'mongoose';
import { connectMongo } from './infrastructure/mongo';
import { registerCoreMiddlewares } from './middlewares/core';
import { registerRoutes } from './routes';
import { logger } from './utils/logger';
import { sendError } from './utils/response';
import { AppError } from './utils/errors';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN ?? '*')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

if (!process.env.JWT_SECRET) {
	throw new Error('JWT_SECRET is required');
}
if (!process.env.MONGODB_URI) {
	throw new Error('MONGODB_URI is required');
}

// Security headers
app.use(helmet());

if (isProduction) {
	app.set('trust proxy', 1);
}

// JSON parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(
	cors({
		origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
		methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
	})
);

// Basic rate limiting
app.use(
	rateLimit({
		windowMs: 60_000,
		max: isProduction ? 100 : 300,
		standardHeaders: true,
		legacyHeaders: false
	})
);

// Healthcheck
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

// Request logger
app.use((req, _res, next) => {
	logger.info(`${req.method} ${req.path}`, { body: req.body ?? {} });
	next();
});

// Swagger UI
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
const swaggerDoc = YAML.load(openapiPath);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Register app middlewares
registerCoreMiddlewares(app);

// Register routes
registerRoutes(app);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	logger.error('Unhandled error', err);

	if (err instanceof AppError) {
		sendError(res, err.statusCode, err.message, err.code, err.details);
		return;
	}

	if (err instanceof mongoose.Error.ValidationError) {
		sendError(res, 422, 'Validation error', 'VALIDATION_ERROR', err.errors);
		return;
	}

	if (err instanceof mongoose.Error.CastError) {
		sendError(res, 400, 'Invalid ID format', 'INVALID_ID');
		return;
	}

	const message = isProduction ? 'Internal server error' : err.message || 'Internal server error';
	sendError(res, 500, message, 'INTERNAL_ERROR', isProduction ? undefined : { stack: err.stack });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
let server: ReturnType<typeof app.listen>;

async function bootstrap() {
	await connectMongo();
	server = app.listen(PORT, () => {
		logger.info(`API listening on http://localhost:${PORT}`);
		logger.info(`Swagger UI at http://localhost:${PORT}/docs`);
	});
}

function gracefulShutdown(signal: string) {
	logger.info(`${signal} received — shutting down gracefully`);
	server?.close(() => {
		logger.info('HTTP server closed');
		mongoose.connection.close(false).then(() => {
			logger.info('MongoDB connection closed');
			process.exit(0);
		});
	});
	setTimeout(() => {
		logger.error('Forced shutdown after timeout');
		process.exit(1);
	}, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap().catch((err) => {
	logger.error('Failed to start server', err);
	process.exit(1);
});
