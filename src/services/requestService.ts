import { pool } from '../db/pool.js';
import { encryptText, generateReference, hashPhone, normalizePhone } from '../utils/security.js';

export interface ServiceRequestInput {
  branchCode?: string;
  requestType: string;
  customerName?: string;
  customerPhone: string;
  detailsAr: string;
  externalConversationId?: string;
}

export async function createServiceRequest(input: ServiceRequestInput): Promise<{ referenceCode: string; status: string }> {
  const phone = normalizePhone(input.customerPhone);
  if (phone.length < 9 || phone.length > 15) throw new Error('INVALID_PHONE');
  const referenceCode = generateReference('REQ');
  const result = await pool.query({
    text: `
      INSERT INTO service_requests
        (reference_code, branch_id, request_type, customer_name_enc, customer_phone_enc,
         customer_phone_hash, details_ar)
      SELECT $1, b.id, $3, $4, $5, $6, $7
      FROM (SELECT 1) x
      LEFT JOIN branches b ON b.code = $2 AND b.is_active = TRUE
      RETURNING reference_code, status
    `,
    values: [
      referenceCode,
      input.branchCode ?? null,
      input.requestType,
      encryptText(input.customerName),
      encryptText(phone),
      hashPhone(phone),
      input.detailsAr
    ]
  });
  return { referenceCode: result.rows[0].reference_code, status: result.rows[0].status };
}
