import { pool } from '../db/pool.js';
import { encryptText, generateReference, hashPhone, normalizePhone } from '../utils/security.js';
import type { DraftItemInput } from '../types.js';
import { calculateDraftTotal, calculateLineTotal } from './pricing.js';

export interface CreateDraftInput {
  branchCode?: string;
  customerName?: string;
  customerPhone: string;
  fulfillmentType?: 'pickup' | 'delivery';
  requestedDate?: string;
  requestedTime?: string;
  deliveryAddress?: string;
  notesAr?: string;
  items: DraftItemInput[];
}

export async function createOrderDraft(input: CreateDraftInput): Promise<{
  referenceCode: string;
  status: string;
  estimatedTotalSar: number;
  items: Array<{ productCode: string; nameAr: string; quantity: number; unitPriceSar: number; lineTotalSar: number }>;
  noticeAr: string;
}> {
  if (!input.items.length) throw new Error('EMPTY_ITEMS');
  const phone = normalizePhone(input.customerPhone);
  if (phone.length < 9 || phone.length > 15) throw new Error('INVALID_PHONE');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codes = [...new Set(input.items.map(i => i.productCode))];
    const productResult = await client.query({
      text: `SELECT id, product_code, name_ar, price_sar, unit_ar
             FROM products WHERE product_code = ANY($1::text[]) AND is_active = TRUE`,
      values: [codes]
    });
    const products = new Map(productResult.rows.map(r => [r.product_code, r]));
    const normalizedItems = input.items.map(item => {
      const p = products.get(item.productCode);
      if (!p) throw new Error(`PRODUCT_NOT_FOUND:${item.productCode}`);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000) throw new Error('INVALID_QUANTITY');
      const lineTotal = calculateLineTotal(Number(p.price_sar), item.quantity);
      return { item, product: p, lineTotal };
    });
    const total = calculateDraftTotal(normalizedItems.map(x => ({ price: Number(x.product.price_sar), quantity: x.item.quantity })));
    const referenceCode = generateReference('DRAFT');
    const draftResult = await client.query({
      text: `
        INSERT INTO order_drafts
          (reference_code, branch_id, customer_name_enc, customer_phone_enc, customer_phone_hash,
           fulfillment_type, requested_date, requested_time, delivery_address_enc, notes_ar,
           estimated_total_sar, expires_at)
        SELECT $1, b.id, $3, $4, $5, $6, $7::date, $8::time, $9, $10, $11, NOW() + INTERVAL '24 hours'
        FROM (SELECT 1) x
        LEFT JOIN branches b ON b.code = $2 AND b.is_active = TRUE
        RETURNING id, reference_code, status
      `,
      values: [
        referenceCode,
        input.branchCode ?? null,
        encryptText(input.customerName),
        encryptText(phone),
        hashPhone(phone),
        input.fulfillmentType ?? 'pickup',
        input.requestedDate ?? null,
        input.requestedTime ?? null,
        encryptText(input.deliveryAddress),
        input.notesAr ?? null,
        total
      ]
    });
    const draft = draftResult.rows[0];
    for (const x of normalizedItems) {
      await client.query({
        text: `INSERT INTO order_draft_items
          (order_draft_id, product_id, product_code_snapshot, product_name_snapshot, unit_snapshot,
           unit_price_snapshot, quantity, line_total_sar, notes_ar)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        values: [draft.id, x.product.id, x.product.product_code, x.product.name_ar, x.product.unit_ar,
          x.product.price_sar, x.item.quantity, x.lineTotal, x.item.notesAr ?? null]
      });
    }
    await client.query('COMMIT');
    return {
      referenceCode: draft.reference_code,
      status: draft.status,
      estimatedTotalSar: total,
      items: normalizedItems.map(x => ({
        productCode: x.product.product_code,
        nameAr: x.product.name_ar,
        quantity: x.item.quantity,
        unitPriceSar: Number(x.product.price_sar),
        lineTotalSar: x.lineTotal
      })),
      noticeAr: 'هذه مسودة طلب وليست تأكيدًا نهائيًا. يجب أن يراجعها موظف بيرلا ويؤكد التوفر والموعد.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
