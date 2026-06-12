"use client";

import { CampaignDetail } from "@/components/CampaignDetail";

// The detail view itself lives in components/CampaignDetail.tsx so the
// TL console can reuse it with its own (group-restricted) API.
export default function CampaignDetailPage() {
  return (
    <CampaignDetail
      apiBase="/api/admin"
      backHref="/admin/campaigns"
      customerBase="/admin/customers"
    />
  );
}
