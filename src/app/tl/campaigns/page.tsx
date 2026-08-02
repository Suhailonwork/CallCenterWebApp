import { CampaignManager } from '@/components/CampaignManager';

// TL campaign console — same UI as admin, but every API call goes through
// /api/tl/* which only exposes campaigns inside the TL's groups, and a
// group is mandatory when creating a campaign.
export default function TlCampaignsPage() {
  return <CampaignManager apiBase="/api/tl" consoleBase="/tl" requireGroup />;
}
