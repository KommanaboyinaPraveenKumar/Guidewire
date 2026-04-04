"use client";

import { useEffect, useState } from "react";
import ClaimsBoard from "@/components/ClaimsBoard";
import type { ClaimView } from "@/types/platform";

export default function CasesPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadClaims = async () => {
    const response = await fetch("/api/claims");
    if (!response.ok) {
      setLoading(false);
      return;
    }

    const payload = await response.json();
    setClaims(payload);
    setLoading(false);
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const runAutomation = async () => {
    setSyncing(true);
    const response = await fetch("/api/claims", { method: "POST" });
    if (response.ok) {
      await loadClaims();
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Claims management</p>
        <h1 className="text-3xl font-bold text-text">Automated income-loss claims</h1>
        <p className="text-text-dim mt-2">
          Claims are triggered from disruption events, validated for anomaly risk, and routed to instant payout or manual review.
        </p>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-text-dim">Loading claims...</div>
      ) : (
        <ClaimsBoard claims={claims} onRunAutomation={runAutomation} syncing={syncing} />
      )}
    </div>
  );
}
