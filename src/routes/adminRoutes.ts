import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdminToken } from '../middleware/auth.js';
import { normalizeArabic } from '../utils/arabic.js';
import { auditAdmin } from '../services/auditService.js';
import { decryptText } from '../utils/security.js';

export const adminRouter = Router();
adminRouter.use(requireAdminToken);

adminRouter.get('/products', async (req, res) => {
  const q = z.string().max(120).optional().parse(req.query.q);
  const normalized = q ? normalizeArabic(q) : null;
  const result = await pool.query({
    text: `SELECT p.product_code, p.name_ar, p.price_sar, p.unit_code, p.unit_ar,
                  c.name_ar AS category_ar, p.description_ar, p.ingredients_ar, p.allergens_ar,
                  p.preparation_minutes, p.pronunciation_hint, p.is_active,
                  COALESCE(json_agg(DISTINCT pa.alias_ar ORDER BY pa.alias_ar) FILTER (WHERE pa.id IS NOT NULL), '[]') AS aliases,
                  COALESCE(jsonb_object_agg(b.code, bpa.availability_status) FILTER (WHERE b.code IS NOT NULL), '{}'::jsonb) AS availability
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN product_aliases pa ON pa.product_id = p.id
           LEFT JOIN branch_product_availability bpa ON bpa.product_id = p.id
           LEFT JOIN branches b ON b.id = bpa.branch_id
           WHERE ($1::text IS NULL OR p.normalized_name_ar LIKE '%' || $1 || '%'
             OR EXISTS (SELECT 1 FROM product_aliases px WHERE px.product_id=p.id AND px.normalized_alias_ar LIKE '%' || $1 || '%'))
           GROUP BY p.id, c.name_ar
           ORDER BY p.product_code`,
    values: [normalized]
  });
  res.json(result.rows);
});

adminRouter.put('/products/:code', async (req, res) => {
  const code = z.string().min(1).max(40).parse(req.params.code);
  const input = z.object({
    name_ar: z.string().min(2).max(240).optional(),
    price_sar: z.number().min(0).max(1_000_000).optional(),
    unit_code: z.string().min(1).max(40).optional(),
    unit_ar: z.string().min(1).max(80).optional(),
    description_ar: z.string().max(4000).nullable().optional(),
    ingredients_ar: z.string().max(4000).nullable().optional(),
    allergens_ar: z.string().max(2000).nullable().optional(),
    preparation_minutes: z.number().int().min(0).max(100_000).nullable().optional(),
    pronunciation_hint: z.string().max(240).nullable().optional(),
    is_active: z.boolean().optional()
  }).refine(v => Object.keys(v).length > 0, 'No changes supplied').parse(req.body);
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (input.name_ar !== undefined) { add('name_ar', input.name_ar); add('normalized_name_ar', normalizeArabic(input.name_ar)); }
  if (input.price_sar !== undefined) add('price_sar', input.price_sar);
  if (input.unit_code !== undefined) add('unit_code', input.unit_code);
  if (input.unit_ar !== undefined) add('unit_ar', input.unit_ar);
  if (input.description_ar !== undefined) add('description_ar', input.description_ar);
  if (input.ingredients_ar !== undefined) add('ingredients_ar', input.ingredients_ar);
  if (input.allergens_ar !== undefined) add('allergens_ar', input.allergens_ar);
  if (input.preparation_minutes !== undefined) add('preparation_minutes', input.preparation_minutes);
  if (input.pronunciation_hint !== undefined) add('pronunciation_hint', input.pronunciation_hint);
  if (input.is_active !== undefined) add('is_active', input.is_active);
  values.push(code);
  const result = await pool.query({
    text: `UPDATE products SET ${sets.join(', ')} WHERE product_code = $${values.length} RETURNING *`,
    values
  });
  if (!result.rows[0]) return res.status(404).json({ error: 'not_found' });
  await auditAdmin('product.update', 'product', code, input);
  res.json(result.rows[0]);
});

adminRouter.post('/products/:code/aliases', async (req, res) => {
  const code = z.string().min(1).max(40).parse(req.params.code);
  const input = z.object({ alias_ar: z.string().min(2).max(240), pronunciation_hint: z.string().max(240).optional() }).parse(req.body);
  const result = await pool.query({
    text: `INSERT INTO product_aliases (product_id, alias_ar, normalized_alias_ar, pronunciation_hint)
           SELECT p.id, $2, $3, $4 FROM products p WHERE p.product_code = $1
           ON CONFLICT (product_id, normalized_alias_ar) DO UPDATE SET alias_ar=EXCLUDED.alias_ar, pronunciation_hint=EXCLUDED.pronunciation_hint
           RETURNING *`,
    values: [code, input.alias_ar, normalizeArabic(input.alias_ar), input.pronunciation_hint ?? null]
  });
  if (!result.rows[0]) return res.status(404).json({ error: 'not_found' });
  await auditAdmin('product_alias.upsert', 'product', code, input);
  res.status(201).json(result.rows[0]);
});

adminRouter.get('/branches', async (_req, res) => {
  const result = await pool.query('SELECT * FROM branches ORDER BY name_ar');
  res.json(result.rows);
});

adminRouter.put('/branches/:code', async (req, res) => {
  const code = z.string().min(1).max(40).parse(req.params.code);
  const input = z.object({
    name_ar: z.string().min(2).max(160).optional(),
    voice_pronunciation: z.string().max(160).nullable().optional(),
    city_ar: z.string().max(120).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    whatsapp: z.string().max(40).nullable().optional(),
    transfer_phone: z.string().max(40).nullable().optional(),
    address_ar: z.string().max(1000).nullable().optional(),
    map_url: z.string().url().nullable().optional(),
    is_active: z.boolean().optional()
  }).refine(v => Object.keys(v).length > 0, 'No changes supplied').parse(req.body);
  const sets: string[] = []; const values: unknown[] = [];
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column}=$${values.length}`); };
  for (const [key, value] of Object.entries(input)) {
    add(key, value);
    if (key === 'name_ar' && typeof value === 'string') add('normalized_name_ar', normalizeArabic(value));
  }
  values.push(code);
  const result = await pool.query({ text: `UPDATE branches SET ${sets.join(',')} WHERE code=$${values.length} RETURNING *`, values });
  if (!result.rows[0]) return res.status(404).json({ error: 'not_found' });
  await auditAdmin('branch.update', 'branch', code, input);
  res.json(result.rows[0]);
});

adminRouter.get('/service-requests', async (req, res) => {
  const status = z.enum(['new','assigned','in_progress','resolved','cancelled']).optional().parse(req.query.status);
  const result = await pool.query({
    text: `SELECT sr.*, b.name_ar AS branch_name_ar FROM service_requests sr
           LEFT JOIN branches b ON b.id=sr.branch_id
           WHERE ($1::text IS NULL OR sr.status=$1)
           ORDER BY sr.created_at DESC LIMIT 200`,
    values: [status ?? null]
  });
  res.json(result.rows.map(r => ({ ...r, customer_name: decryptText(r.customer_name_enc), customer_phone: decryptText(r.customer_phone_enc), customer_name_enc: undefined, customer_phone_enc: undefined })));
});

adminRouter.get('/order-drafts', async (req, res) => {
  const result = await pool.query(`SELECT od.*, b.name_ar AS branch_name_ar,
    COALESCE(json_agg(json_build_object('product_code',i.product_code_snapshot,'name_ar',i.product_name_snapshot,'quantity',i.quantity,'unit_price_sar',i.unit_price_snapshot,'line_total_sar',i.line_total_sar)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
    FROM order_drafts od LEFT JOIN branches b ON b.id=od.branch_id LEFT JOIN order_draft_items i ON i.order_draft_id=od.id
    GROUP BY od.id,b.name_ar ORDER BY od.created_at DESC LIMIT 200`);
  res.json(result.rows.map(r => ({ ...r, customer_name: decryptText(r.customer_name_enc), customer_phone: decryptText(r.customer_phone_enc), delivery_address: decryptText(r.delivery_address_enc), customer_name_enc: undefined, customer_phone_enc: undefined, delivery_address_enc: undefined })));
});


adminRouter.put('/availability/:branchCode/:productCode', async (req, res) => {
  const params = z.object({
    branchCode: z.enum(['ALKHARJ','DILAM']),
    productCode: z.string().min(1).max(40)
  }).parse(req.params);
  const input = z.object({
    availability_status: z.enum(['available','unavailable','unknown']),
    availability_note_ar: z.string().max(500).nullable().optional()
  }).parse(req.body);
  const result = await pool.query({
    text: `INSERT INTO branch_product_availability(branch_id,product_id,availability_status,availability_note_ar,updated_at)
           SELECT b.id,p.id,$3,$4,NOW() FROM branches b CROSS JOIN products p
           WHERE b.code=$1 AND p.product_code=$2
           ON CONFLICT(branch_id,product_id) DO UPDATE SET availability_status=EXCLUDED.availability_status,
             availability_note_ar=EXCLUDED.availability_note_ar,updated_at=NOW()
           RETURNING *`,
    values: [params.branchCode, params.productCode, input.availability_status, input.availability_note_ar??null]
  });
  if (!result.rows[0]) return res.status(404).json({ error: 'not_found' });
  await auditAdmin('availability.update','product',params.productCode,{branch:params.branchCode,...input});
  res.json(result.rows[0]);
});

adminRouter.get('/policies', async (_req, res) => {
  const result = await pool.query('SELECT * FROM business_policies ORDER BY policy_key');
  res.json(result.rows);
});

adminRouter.put('/policies/:key', async (req, res) => {
  const key = z.string().min(1).max(80).parse(req.params.key);
  const input = z.object({title_ar:z.string().min(2).max(200),content_ar:z.string().min(2).max(5000),is_active:z.boolean().default(true)}).parse(req.body);
  const result = await pool.query({
    text:`INSERT INTO business_policies(policy_key,title_ar,content_ar,is_active,updated_at)
          VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(policy_key) DO UPDATE SET title_ar=EXCLUDED.title_ar,
          content_ar=EXCLUDED.content_ar,is_active=EXCLUDED.is_active,updated_at=NOW() RETURNING *`,
    values:[key,input.title_ar,input.content_ar,input.is_active]
  });
  await auditAdmin('policy.upsert','policy',key,input);
  res.json(result.rows[0]);
});

adminRouter.get('/branches/:code/hours', async (req, res) => {
  const code=z.enum(['ALKHARJ','DILAM']).parse(req.params.code);
  const result=await pool.query({text:`SELECT h.* FROM business_hours h JOIN branches b ON b.id=h.branch_id WHERE b.code=$1 ORDER BY day_of_week`,values:[code]});
  res.json(result.rows);
});

adminRouter.put('/branches/:code/hours/:day', async (req, res) => {
  const params=z.object({code:z.enum(['ALKHARJ','DILAM']),day:z.coerce.number().int().min(0).max(6)}).parse(req.params);
  const input=z.object({opens_at:z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),closes_at:z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),is_closed:z.boolean().default(false),note_ar:z.string().max(240).nullable().optional()}).parse(req.body);
  const result=await pool.query({text:`INSERT INTO business_hours(branch_id,day_of_week,opens_at,closes_at,is_closed,note_ar)
    SELECT b.id,$2,$3::time,$4::time,$5,$6 FROM branches b WHERE b.code=$1
    ON CONFLICT(branch_id,day_of_week) DO UPDATE SET opens_at=EXCLUDED.opens_at,closes_at=EXCLUDED.closes_at,is_closed=EXCLUDED.is_closed,note_ar=EXCLUDED.note_ar RETURNING *`,values:[params.code,params.day,input.opens_at??null,input.closes_at??null,input.is_closed,input.note_ar??null]});
  if(!result.rows[0])return res.status(404).json({error:'not_found'});
  await auditAdmin('business_hours.upsert','branch',params.code,{day:params.day,...input});
  res.json(result.rows[0]);
});

adminRouter.get('/tool-audit', async (_req, res) => {
  const result = await pool.query(`SELECT id, request_id, tool_name, client_label, success, duration_ms, arguments_redacted, result_summary, error_code, created_at FROM tool_audit ORDER BY created_at DESC LIMIT 500`);
  res.json(result.rows);
});
