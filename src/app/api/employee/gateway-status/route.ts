import { authenticate, isError, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { gwEndpoint } from '@/lib/asteriskRealtime';

export const runtime = 'nodejs';

/**
 * GET /api/employee/gateway-status?campaignId=X
 * Returns whether the campaign's assigned gateways are reachable via Asterisk ARI.
 */
export async function GET(req: Request) {
  const u = await authenticate(['employee']);
  if (isError(u)) return u;

  const { searchParams } = new URL(req.url);
  const campaignId = Number(searchParams.get('campaignId'));
  if (!campaignId) return ok({ reachable: false, reason: 'No campaign' });

  const ariUrl  = process.env.ARI_URL  ?? 'http://localhost:8088';
  const ariUser = process.env.ARI_USER ?? 'admin';
  const ariPass = process.env.ARI_PASS ?? 'adminsecret';

  // Get gateways assigned to this campaign
  const gateways = await query<{ id: number; name: string }>(
    `SELECT g.id, g.name
       FROM campaign_gateways cg
       JOIN gsm_gateways g ON g.id = cg.gateway_id
      WHERE cg.campaign_id = ? AND g.status = 'active'`,
    [campaignId],
  );

  if (gateways.length === 0) {
    return ok({ reachable: false, reason: 'No gateway assigned to this campaign' });
  }

  // Check each gateway — return true if at least one is online
  for (const gw of gateways) {
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
      if (res.ok) {
        const data = await res.json();
        // GSM gateways often ignore SIP OPTIONS qualify but still place calls,
        // so treat anything that isn't an explicit 'offline' as reachable.
        if ((data.state ?? 'unknown') !== 'offline') {
          return ok({ reachable: true, gateway: gw.name });
        }
      }
    } catch {
      // continue to next gateway
    }
  }

  return ok({
    reachable: false,
    reason: `Gateway${gateways.length > 1 ? 's' : ''} offline — ${gateways.map((g) => g.name).join(', ')}`,
  });
}
