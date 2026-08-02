'use client';

import { useState } from 'react';
import { useSocketEvent } from '@/lib/useSocket';

interface Agent {
  id: number;
  name: string;
  state: string;
}

const STATE_STYLE: Record<string, string> = {
  'on-call': 'bg-indigo-100 text-indigo-700',
  idle: 'bg-green-100 text-green-700',
  online: 'bg-green-100 text-green-700',
  wrapup: 'bg-amber-100 text-amber-700',
  paused: 'bg-slate-100 text-slate-600',
};

export function LiveAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useSocketEvent('agents-updated', (list: Agent[]) => {
    setAgents(Array.isArray(list) ? list : []);
  });

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
        Live agents — {agents.length} online
      </h2>
      {agents.length === 0 ? (
        <p className="text-sm text-slate-400">No agents are online right now.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {agents.map((a) => (
            <span
              key={a.id}
              className={
                'rounded-full px-3 py-1 text-xs font-medium ' +
                (STATE_STYLE[a.state] ?? 'bg-slate-100 text-slate-600')
              }
            >
              {a.name} · {a.state === 'on-call' ? 'on call' : a.state}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
