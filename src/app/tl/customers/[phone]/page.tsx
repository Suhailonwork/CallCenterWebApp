"use client";

import { CustomerHistory } from "@/components/CustomerHistory";

export default function TlCustomerDetailPage() {
  return <CustomerHistory apiBase="/api/tl" />;
}
