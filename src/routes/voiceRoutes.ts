import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireVoiceToken } from '../middleware/auth.js';
import { getBranch, getPolicies, getProductByCode, listBranches, listCategories, listPublicLinks, searchProducts } from '../repositories/catalogRepository.js';
import { createServiceRequest } from '../services/requestService.js';
import { createOrderDraft } from '../services/draftService.js';
import { env } from '../config/env.js';

export const voiceRouter = Router();
voiceRouter.use(requireVoiceToken);
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false });

voiceRouter.get('/products/search', async (req, res) => {
  const query = z.object({
    q: z.string().min(1).max(120),
    category: z.string().max(120).optional(),
    branch_code: z.enum(['ALKHARJ', 'DILAM']).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(8)
  }).parse(req.query);
  const products = await searchProducts(query.q, { category: query.category, branchCode: query.branch_code, limit: query.limit });
  res.json({ currency: 'SAR', prices_unified_across_branches: true, products });
});

voiceRouter.get('/products/:code', async (req, res) => {
  const params = z.object({ code: z.string().min(1).max(40) }).parse(req.params);
  const branchCode = z.enum(['ALKHARJ', 'DILAM']).optional().parse(req.query.branch_code);
  const product = await getProductByCode(params.code, branchCode);
  if (!product) return res.status(404).json({ error: 'not_found', message: 'المنتج غير موجود.' });
  res.json(product);
});

voiceRouter.get('/categories', async (_req, res) => res.json(await listCategories()));
voiceRouter.get('/branches', async (_req, res) => res.json(await listBranches()));
voiceRouter.get('/branches/:code', async (req, res) => {
  const code = z.enum(['ALKHARJ', 'DILAM']).parse(req.params.code);
  const branch = await getBranch(code);
  if (!branch) return res.status(404).json({ error: 'not_found', message: 'الفرع غير موجود.' });
  res.json(branch);
});
voiceRouter.get('/policies', async (req, res) => {
  const key = z.string().max(80).optional().parse(req.query.key);
  res.json(await getPolicies(key));
});

voiceRouter.get('/links', async (req, res) => {
  const type = z.enum(['official_hub','whatsapp','instagram','tiktok','snapchat','map','ordering','general']).optional().parse(req.query.type);
  res.json(await listPublicLinks(type));
});


voiceRouter.post('/service-requests', writeLimiter, async (req, res) => {
  if (!env.ENABLE_WRITE_TOOLS) return res.status(403).json({ error: 'write_tools_disabled' });
  const input = z.object({
    branch_code: z.enum(['ALKHARJ', 'DILAM']).optional(),
    request_type: z.enum(['callback', 'complaint', 'custom_cake', 'large_order', 'general_followup']),
    customer_name: z.string().max(160).optional(),
    customer_phone: z.string().min(9).max(30),
    details_ar: z.string().min(3).max(2000)
  }).parse(req.body);
  const result = await createServiceRequest({
    branchCode: input.branch_code,
    requestType: input.request_type,
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    detailsAr: input.details_ar
  });
  res.status(201).json(result);
});

voiceRouter.post('/order-drafts', writeLimiter, async (req, res) => {
  if (!env.ENABLE_WRITE_TOOLS) return res.status(403).json({ error: 'write_tools_disabled' });
  const input = z.object({
    branch_code: z.enum(['ALKHARJ', 'DILAM']).optional(),
    customer_name: z.string().max(160).optional(),
    customer_phone: z.string().min(9).max(30),
    fulfillment_type: z.enum(['pickup', 'delivery']).default('pickup'),
    requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    requested_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    delivery_address: z.string().max(500).optional(),
    notes_ar: z.string().max(2000).optional(),
    items: z.array(z.object({
      product_code: z.string().min(1).max(40),
      quantity: z.number().positive().max(1000),
      notes_ar: z.string().max(500).optional()
    })).min(1).max(30)
  }).parse(req.body);
  const result = await createOrderDraft({
    branchCode: input.branch_code,
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    fulfillmentType: input.fulfillment_type,
    requestedDate: input.requested_date,
    requestedTime: input.requested_time,
    deliveryAddress: input.delivery_address,
    notesAr: input.notes_ar,
    items: input.items.map(i => ({ productCode: i.product_code, quantity: i.quantity, notesAr: i.notes_ar }))
  });
  res.status(201).json(result);
});
