import { pool } from '../db/pool.js';
import { redactForAudit } from '../utils/security.js';

export async function auditToolCall(input: {
  toolName: string;
  clientLabel?: string;
  success: boolean;
  durationMs: number;
  args?: unknown;
  resultSummary?: unknown;
  errorCode?: string;
}): Promise<void> {
  try {
    await pool.query({
      text: `INSERT INTO tool_audit
        (tool_name, client_label, success, duration_ms, arguments_redacted, result_summary, error_code)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      values: [
        input.toolName,
        input.clientLabel ?? null,
        input.success,
        Math.max(0, Math.round(input.durationMs)),
        JSON.stringify(redactForAudit(input.args ?? {})),
        JSON.stringify(redactForAudit(input.resultSummary ?? {})),
        input.errorCode ?? null
      ]
    });
  } catch (error) {
    console.error('Failed to record tool audit', error);
  }
}

export async function auditAdmin(action: string, entityType: string, entityId: string | null, changes: unknown): Promise<void> {
  await pool.query({
    text: `INSERT INTO admin_audit (action, entity_type, entity_id, changes_redacted)
           VALUES ($1, $2, $3, $4::jsonb)`,
    values: [action, entityType, entityId, JSON.stringify(redactForAudit(changes))]
  });
}
