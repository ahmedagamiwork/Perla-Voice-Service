import { pool } from '../db/pool.js';
import { normalizeArabic, searchTokens } from '../utils/arabic.js';
import type { ProductSearchResult } from '../types.js';

function mapProduct(row: Record<string, unknown>): ProductSearchResult {
  return {
    id: String(row.id),
    productCode: String(row.product_code),
    nameAr: String(row.name_ar),
    priceSar: Number(row.price_sar),
    unitCode: String(row.unit_code),
    unitAr: String(row.unit_ar),
    categoryAr: row.category_ar ? String(row.category_ar) : null,
    descriptionAr: row.description_ar ? String(row.description_ar) : null,
    allergensAr: row.allergens_ar ? String(row.allergens_ar) : null,
    pronunciationHint: row.pronunciation_hint ? String(row.pronunciation_hint) : null,
    availabilityStatus: row.availability_status as ProductSearchResult['availabilityStatus'],
    availabilityNoteAr: row.availability_note_ar ? String(row.availability_note_ar) : null
  };
}

export async function searchProducts(query: string, options: { category?: string; branchCode?: string; limit?: number } = {}): Promise<ProductSearchResult[]> {
  const normalized = normalizeArabic(query);
  const tokens = searchTokens(query);
  if (!normalized || tokens.length === 0) return [];
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
  const params: unknown[] = [normalized, tokens, options.category ? normalizeArabic(options.category) : null, options.branchCode ?? null, limit];
  const result = await pool.query({
    text: `
      WITH matched AS (
        SELECT p.id,
               CASE
                 WHEN p.normalized_name_ar = $1 THEN 100
                 WHEN EXISTS (SELECT 1 FROM product_aliases pa WHERE pa.product_id = p.id AND pa.normalized_alias_ar = $1) THEN 95
                 WHEN p.normalized_name_ar LIKE '%' || $1 || '%' THEN 80
                 WHEN EXISTS (SELECT 1 FROM product_aliases pa WHERE pa.product_id = p.id AND pa.normalized_alias_ar LIKE '%' || $1 || '%') THEN 75
                 ELSE (
                   SELECT COALESCE(SUM(CASE WHEN p.normalized_name_ar LIKE '%' || t || '%' THEN 10 ELSE 0 END), 0)
                   FROM unnest($2::text[]) t
                 )
               END AS score
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = TRUE
          AND ($3::text IS NULL OR c.normalized_name_ar = $3)
      )
      SELECT p.*, c.name_ar AS category_ar,
             COALESCE(bpa.availability_status, 'unknown') AS availability_status,
             bpa.availability_note_ar
      FROM matched m
      JOIN products p ON p.id = m.id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN branches b ON b.code = $4
      LEFT JOIN branch_product_availability bpa ON bpa.product_id = p.id AND bpa.branch_id = b.id
      WHERE m.score > 0
      ORDER BY m.score DESC, p.name_ar ASC
      LIMIT $5
    `,
    values: params
  });
  return result.rows.map(mapProduct);
}

export async function getProductByCode(productCode: string, branchCode?: string): Promise<ProductSearchResult | null> {
  const result = await pool.query({
    text: `
      SELECT p.*, c.name_ar AS category_ar,
             COALESCE(bpa.availability_status, 'unknown') AS availability_status,
             bpa.availability_note_ar
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN branches b ON b.code = $2
      LEFT JOIN branch_product_availability bpa ON bpa.product_id = p.id AND bpa.branch_id = b.id
      WHERE p.product_code = $1 AND p.is_active = TRUE
      LIMIT 1
    `,
    values: [productCode, branchCode ?? null]
  });
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

export async function listCategories(): Promise<Array<{ nameAr: string; productCount: number }>> {
  const result = await pool.query(`
    SELECT c.name_ar, COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
    WHERE c.is_active = TRUE
    GROUP BY c.id
    ORDER BY c.sort_order, c.name_ar
  `);
  return result.rows.map(r => ({ nameAr: r.name_ar, productCount: Number(r.product_count) }));
}

export async function listBranches(): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(`
    SELECT code, name_ar, voice_pronunciation, city_ar, phone, whatsapp, transfer_phone,
           address_ar, map_url, timezone
    FROM branches WHERE is_active = TRUE ORDER BY name_ar
  `);
  return result.rows;
}

export async function getBranch(code: string): Promise<Record<string, unknown> | null> {
  const branchResult = await pool.query({
    text: `SELECT id, code, name_ar, voice_pronunciation, city_ar, phone, whatsapp,
                  transfer_phone, address_ar, map_url, timezone
           FROM branches WHERE code = $1 AND is_active = TRUE LIMIT 1`,
    values: [code]
  });
  const branch = branchResult.rows[0];
  if (!branch) return null;
  const hours = await pool.query({
    text: `SELECT day_of_week, opens_at, closes_at, is_closed, note_ar
           FROM business_hours WHERE branch_id = $1 ORDER BY day_of_week`,
    values: [branch.id]
  });
  delete branch.id;
  return { ...branch, business_hours: hours.rows };
}

export async function getPolicies(policyKey?: string): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query({
    text: `SELECT policy_key, title_ar, content_ar, updated_at
           FROM business_policies
           WHERE is_active = TRUE AND ($1::text IS NULL OR policy_key = $1)
           ORDER BY policy_key`,
    values: [policyKey ?? null]
  });
  return result.rows;
}


export async function listPublicLinks(linkType?: string): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query({
    text: `SELECT pl.link_key, pl.title_ar, pl.url, pl.link_type,
                  b.code AS branch_code, b.name_ar AS branch_name_ar
           FROM public_links pl
           LEFT JOIN branches b ON b.id = pl.branch_id
           WHERE pl.is_active = TRUE
             AND ($1::text IS NULL OR pl.link_type = $1)
           ORDER BY pl.sort_order, pl.link_key`,
    values: [linkType ?? null]
  });
  return result.rows;
}
