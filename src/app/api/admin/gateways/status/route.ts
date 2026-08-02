import { authenticate, isError, ok, fail } from '@/lib/api';
import { query } from '@/lib/db';
import { gwEndpoint } from '@/lib/asteriskRealtime';

export const runtime = 'nodejs';

/**
 * GET /api/admin/gateways/status
 * Returns reachability status for all gateways by querying Asterisk ARI.
 */
export async function GET() {
  const u = await authenticate(['admin', 'manager', 'tl']);
  if (isError(u)) return u;

  const ariUrl  = process.env.ARI_URL  ?? 'http://localhost:8088';
  const ariUser = process.env.ARI_USER ?? 'admin';
  const ariPass = process.env.ARI_PASS ?? 'adminsecret';

  // Get all gateways with asterisk_endpoint set
  const gateways = await query<{ id: number; name: string }>(
    `SELECT id, name FROM gsm_gateways WHERE status = 'active'`,
  );

  const statusMap: Record<number, { reachable: boolean; state: string }> = {};

  await Promise.all(
    gateways.map(async (gw) => {
      const endpoint = gwEndpoint(gw.id); // always gw{id} — no mismatch possible
      try {
        const res = await fetch(
          `${ariUrl}/ari/endpoints/PJSIP/${endpoint}`,
          {
            headers: {
              Authorization: 'Basic ' + Buffer.from(`${ariUser}:${ariPass}`).toString('base64'),
            },
          },
        );
        if (!res.ok) {
          statusMap[gw.id] = { reachable: false, state: 'unknown' };
          return;
        }
        const data = await res.json();
        // ARI endpoint state: 'online' | 'offline' | 'unknown'.
        // GSM/Dinstar gateways often ignore SIP OPTIONS qualify but still accept
        // INVITEs, so we only treat an *explicit* 'offline' as unreachable.
        // 'unknown' (qualify disabled / not yet known) is considered reachable.
        const state = data.state ?? 'unknown';
        const reachable = state !== 'offline';
        statusMap[gw.id] = { reachable, state };
      } catch {
        statusMap[gw.id] = { reachable: false, state: 'unreachable' };
      }
    }),
  );

  return ok({ status: statusMap });
}
