'use client';

import { useState } from 'react';
import { CampaignAssign } from './CampaignAssign';

interface CampaignLite {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export function ManagerCampaigns({ campaigns }: { campaigns: CampaignLite[] }) {
  const [assignFor, setAssignFor] = useState<{ id: number; name: string } | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Campaigns</h1>
      <p className="text-sm text-slate-500">
        Assign active campaigns to the agents on your team, or download any
        campaign&apos;s results.
      </p>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">No campaigns.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {c.name}
                    {c.status !== 'active' && (
                      <span className="ml-2 text-xs font-normal capitalize text-slate-400">
                        {c.status}
                      </span>
                    )}
                  </p>
                  {c.description && (
                    <p className="text-xs text-slate-500">{c.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/manager/campaigns/${c.id}/export`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                  >
                    Download CSV
                  </a>
                  {c.status === 'active' && (
                    <button
                      onClick={() => setAssignFor({ id: c.id, name: c.name })}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Assign agents
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assignFor && (
        <CampaignAssign
          campaignId={assignFor.id}
          campaignName={assignFor.name}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  );
}
