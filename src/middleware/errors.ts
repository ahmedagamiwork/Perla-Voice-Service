import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'المسار غير موجود.' });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  (req as unknown as { log?: { error: (obj: unknown, msg: string) => void } }).log?.error({ err }, 'request_failed');
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'البيانات المرسلة غير صحيحة.',
      details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
    });
    return;
  }
  const message = err instanceof Error ? err.message : '';
  if (['INVALID_PHONE','EMPTY_ITEMS','INVALID_QUANTITY','INVALID_PRICE'].includes(message)) {
    res.status(400).json({ error: message.toLowerCase(), message: 'البيانات المرسلة غير صالحة.' });
    return;
  }
  if (message.startsWith('PRODUCT_NOT_FOUND:')) {
    res.status(404).json({ error: 'product_not_found', product_code: message.split(':')[1], message: 'المنتج غير موجود أو غير نشط.' });
    return;
  }
  const pgCode = (err as { code?: string }).code;
  if (pgCode === '23505') {
    res.status(409).json({ error: 'conflict', message: 'البيانات موجودة بالفعل.' });
    return;
  }
  if (pgCode === '23503' || pgCode === '23514' || pgCode === '22P02') {
    res.status(400).json({ error: 'invalid_data', message: 'البيانات غير صالحة للعملية المطلوبة.' });
    return;
  }
  res.status(500).json({ error: 'internal_error', message: 'حدث خطأ داخلي غير متوقع.' });
};
