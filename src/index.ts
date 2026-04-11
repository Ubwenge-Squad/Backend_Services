import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { connectMongo } from './infrastructure/mongo';
import { registerCoreMiddlewares } from './middlewares/core';
import { registerRoutes } from './routes';

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
	// Needed when running behind reverse proxies on common cloud platforms.
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

// Request logger — logs method, path, and body to Render logs
app.use((req, _res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, JSON.stringify(req.body ?? {}));
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

// Global error handler — catches any unhandled errors and returns JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	console.error('[Unhandled error]', err);
	res.status(err.status || 500).json({
		message: err.message || 'Internal server error',
		...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
	});
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

async function bootstrap() {
	await connectMongo();
	app.listen(PORT, () => {
		console.log(`API listening on http://localhost:${PORT}`);
		console.log(`Swagger UI at http://localhost:${PORT}/docs`);
	});
}

bootstrap().catch((err) => {
	console.error('Failed to start server', err);
	process.exit(1);
});

