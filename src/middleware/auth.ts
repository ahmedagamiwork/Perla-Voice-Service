import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { extractBearer, safeTokenEqual } from '../utils/security.js';

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'unauthorized', message: 'رمز الوصول غير صالح.' });
}

export function requireVoiceToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req.header('authorization'));
  if (!safeTokenEqual(env.VOICE_API_TOKEN, token)) return unauthorized(res);
  next();
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req.header('authorization'));
  if (!safeTokenEqual(env.ADMIN_API_TOKEN, token)) return unauthorized(res);
  next();
}
