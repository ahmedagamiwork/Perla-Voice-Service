import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { mcpRouter } from './routes/mcpRoutes.js';
import { voiceRouter } from './routes/voiceRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({ level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.body.customer_phone', 'req.body.customer_name'] }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"]
      }
    }
  }));

  if (env.allowedOrigins.length) {
    app.use(cors({ origin: env.allowedOrigins, credentials: false }));
  }
  app.use(express.json({ limit: '256kb' }));

  const voiceLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'perla-voice-service', version: '1.0.1' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/mcp', voiceLimiter, mcpRouter);
  app.use('/api/v1/voice', voiceLimiter, voiceRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/admin', express.static(path.resolve(__dirname, '../../public')));
  app.get('/', (_req, res) => res.json({ service: 'Perla Voice Service', admin: '/admin', health: '/health', mcp: '/mcp' }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
