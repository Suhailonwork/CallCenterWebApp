import { query } from '@/lib/db';
import { ManagerCampaigns } from '@/components/ManagerCampaigns';

export const dynamic = 'force-dynamic';

export default async function ManagerCampaignsPage() {
  const campaigns = await query<{
    id: number;
    name: string;
    description: string | null;
    status: string;
  }>(
    `SELECT id, name, description, status
       FROM campaigns
      WHERE status = 'active'
      ORDER BY name`,
  );
  return <ManagerCampaigns campaigns={campaigns} />;
}
