import { DialerDashboard } from '@/components/DialerDashboard';

export const dynamic = 'force-dynamic';

export default function TeamLeadDialerPage() {
  return <DialerDashboard endpoint="/api/tl/dialer/live" />;
}
