"use client";

import { CampaignDetail } from "@/components/CampaignDetail";

export default function TlCampaignDetailPage() {
  return (
    <CampaignDetail
      apiBase="/api/tl"
      backHref="/tl/campaigns"
      customerBase="/tl/customers"
    />
  );
}
