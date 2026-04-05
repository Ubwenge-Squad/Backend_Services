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

// Security headers
app.use(helmet());

// JSON parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','DELETE','OPTIONS'] }));

// Basic rate limiting
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Healthcheck
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

// Swagger UI
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
const swaggerDoc = YAML.load(openapiPath);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Register app middlewares
registerCoreMiddlewares(app);

// Register routes
registerRoutes(app);

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

