const isProduction = process.env.NODE_ENV === 'production';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
	const timestamp = new Date().toISOString();
	const metaStr = meta !== undefined ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '';
	return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
	debug(message: string, meta?: unknown) {
		if (!shouldLog('debug')) return;
		console.debug(formatMessage('debug', message, meta));
	},
	info(message: string, meta?: unknown) {
		if (!shouldLog('info')) return;
		console.info(formatMessage('info', message, meta));
	},
	warn(message: string, meta?: unknown) {
		if (!shouldLog('warn')) return;
		console.warn(formatMessage('warn', message, meta));
	},
	error(message: string, meta?: unknown) {
		if (!shouldLog('error')) return;
		console.error(formatMessage('error', message, meta));
	},
};
