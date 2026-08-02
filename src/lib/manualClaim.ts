import { LEAD_STATUS } from '@/lib/leadStatus';

/**
 * Guards shared by the manual-dialer routes (next / verify / release).
 *
 * The predictive engine keeps its per-phone lock in process memory, which the
 * Next.js API routes cannot see. These helpers ask the database instead, so a
 * manual agent and the engine are held to the same rule from either side.
 */

/** Digits only — the same normalisation the engine's phone lock uses. */
export function normPhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * A call row that somehow never got an ended_at is treated as finished after
 * this long, so one lost hangup event cannot bar a number forever. Matches the
 * dialer_oncall_timeout_sec default, the longest a real conversation may run
 * before the engine's sweeper force-ends it.
 */
const ZOMBIE_CALL_SEC = 1800;

/**
 * Is this number on a call RIGHT NOW?
 *
 * Different rows legitimately carry the same phone_number (the same customer
 * imported on several lists) and we keep every one of them — but the customer
 * has a single handset, so two attempts must never be live at once.
 *
 * What counts as "on a call" is the CALL lifecycle, never the lead's status:
 *
 *   · `calls` row with ended_at IS NULL  -> a real attempt is in progress.
 *   · csv_data DIALING / RINGING         -> belt-and-braces; markDialing and
 *     markRinging only ever write these for an origination that really left,
 *     so they cannot produce a false positive if a history insert was lost.
 *
 * Deliberately NOT treated as a call:
 *
 *   · ended_at IS NOT NULL — history, however recent, and whatever `status`
 *     says. `status` stays 'connected' on a finished call forever.
 *   · csv_data QUEUED + claimed_at — a lead reserved for an agent's screen.
 *     Loading or holding a lead is not dialing it.
 *   · csv_data CONNECTED — a lead OUTCOME that persists for the row's lifetime
 *     once it has ever been talked to.
 *
 * @param db      pool or an open connection — must expose .query()
 * @param phone   raw phone number; normalised internally
 * @param exceptLeadId  the lead we are about to dial, ignored in the check
 * @returns the blocking calls.id / csv_data.id, or null when the line is free
 */
export async function phoneIsBusy(
  db: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  phone: unknown,
  exceptLeadId: number,
): Promise<number | null> {
  const digits = normPhone(phone);
  if (!digits) return null;

  const [live] = (await db.query(
    `SELECT id FROM calls
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '') = ?
        AND ended_at IS NULL
        AND started_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
      LIMIT 1`,
    [digits, ZOMBIE_CALL_SEC],
  )) as [Array<{ id: number }>, unknown];
  if (live.length > 0) return live[0].id;

  const [dialing] = (await db.query(
    `SELECT id FROM csv_data
      WHERE REGEXP_REPLACE(phone_number, '[^0-9]', '') = ?
        AND id <> ?
        AND call_status IN (?, ?)
      LIMIT 1`,
    [digits, exceptLeadId, LEAD_STATUS.DIALING, LEAD_STATUS.RINGING],
  )) as [Array<{ id: number }>, unknown];

  return dialing.length > 0 ? dialing[0].id : null;
}
