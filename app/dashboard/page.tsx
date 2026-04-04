"use client";

import { useEffect, useState } from "react";
import DashboardCharts from "@/components/DashboardCharts";
import ClaimsBoard from "@/components/ClaimsBoard";
import type { DashboardResponse } from "@/types/platform";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text-dim">Loading analytics...</div>;
  }

  if (!data) {
    return <div className="text-text-dim">Unable to load analytics right now.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Analytics</p>
        <h1 className="text-3xl font-bold text-text">Income protection dashboard</h1>
        <p className="text-text-dim mt-2">
          Track weekly pricing, live disruption exposure, and the value already protected through automated payouts.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="bg-surface border border-border rounded-xl p-5">
            <p className="text-text-dim text-xs font-mono uppercase tracking-wider mb-1">{metric.label}</p>
            <p className={`text-3xl font-bold ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts
        claimsByStatus={data.claimsByStatus}
        triggerExposure={data.triggerExposure}
        payoutTrend={data.payoutTrend}
      />

      <ClaimsBoard claims={data.recentClaims} compact />
    </div>
  );
}
