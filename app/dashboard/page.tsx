"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCharts from "@/components/DashboardCharts";
import type { ClaimResult } from "@/types/claim";

export default function DashboardPage() {
  const [claims, setClaims] = useState<ClaimResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analyze-claim")
      .then((response) => response.json())
      .then((data) => setClaims(data))
      .finally(() => setLoading(false));
  }, []);

  const { total, critical, high, avgScore } = useMemo(() => {
    const totalClaims = claims.length;
    const criticalClaims = claims.filter((c) => c.risk_level === "CRITICAL").length;
    const highClaims = claims.filter((c) => c.risk_level === "HIGH").length;
    const averageScore = Math.round(claims.reduce((sum, claim) => sum + claim.risk_score, 0) / (totalClaims || 1));

    return {
      total: totalClaims,
      critical: criticalClaims,
      high: highClaims,
      avgScore: averageScore,
    };
  }, [claims]);

  if (loading) {
    return <div className="text-text-dim">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Analytics</p>
        <h1 className="text-3xl font-bold text-text">Fraud Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Claims", value: total, color: "text-text" },
          { label: "Critical Risk", value: critical, color: "text-red-300" },
          { label: "High Risk", value: high, color: "text-orange-300" },
          { label: "Avg Risk Score", value: `${avgScore}`, color: "text-accent" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-xl p-5">
            <p className="text-text-dim text-xs font-mono uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts claims={claims} />
    </div>
  );
}
