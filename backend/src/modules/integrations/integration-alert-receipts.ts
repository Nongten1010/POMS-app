import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../config/database';

/** Only transport shape is validated. Archived values are neither interpreted nor normalized. */
export const integrationAlertReceiptBatchSchema = z
  .object({ events: z.array(z.record(z.string(), z.unknown())).min(1).max(500) })
  .passthrough();

export function createIntegrationAlertReceiptStore(connection: Knex) {
  return {
    async storeBatch(input: unknown) {
      const payload = integrationAlertReceiptBatchSchema.parse(input);
      const receiptId = randomUUID();
      const receivedAt = new Date();
      try {
        // One bound INSERT per request, including repeated requests. Never touch alert identities.
        await connection('integration_alert_receipts').insert({
          receipt_id: receiptId,
          received_at: receivedAt,
          event_count: payload.events.length,
          payload_json: JSON.stringify(payload),
        });
      } catch {
        // Knex errors may contain the full SQL bindings. Do not forward or log incoming payloads.
        throw new Error('INTEGRATION_ALERT_RECEIPT_STORE_FAILED');
      }
      return {
        mode: 'STORE_ONLY' as const,
        receiptId,
        receivedAt: receivedAt.toISOString(),
        total: payload.events.length,
        stored: payload.events.length,
        created: 0,
        duplicate: 0,
        failed: 0,
        results: payload.events.map((_, index) => ({
          index,
          success: true,
          created: false,
          duplicate: false,
          event: null,
        })),
      };
    },
  };
}

export const integrationAlertReceipts = createIntegrationAlertReceiptStore(db);
