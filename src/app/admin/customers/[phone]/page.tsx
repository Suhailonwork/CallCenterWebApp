"use client";

import { CustomerHistory } from "@/components/CustomerHistory";

// The history view lives in components/CustomerHistory.tsx so the
// TL console can reuse it with its own (group-restricted) API.
export default function CustomerDetailPage() {
  return <CustomerHistory apiBase="/api/admin" />;
}
