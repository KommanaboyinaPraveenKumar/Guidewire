"use client";

import { useEffect, useState } from "react";
import ClaimsBoard from "@/components/ClaimsBoard";
import ClaimForm from "@/components/ClaimForm";
import type { ClaimView } from "@/types/platform";

export default function CasesPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"automated" | "manual">("automated");

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
        <h1 className="text-3xl font-bold text-text">Income-loss claims</h1>
        <p className="text-text-dim mt-2">
          Manage automated claims from disruption events or submit manual claims for fraud detection analysis.
        </p>
      </div>

      <div className="flex space-x-1 bg-surface border border-border rounded-lg p-1">
        <button
          onClick={() => setActiveTab("automated")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "automated"
              ? "bg-accent text-white"
              : "text-text-dim hover:text-text"
          }`}
        >
          Automated Claims
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "manual"
              ? "bg-accent text-white"
              : "text-text-dim hover:text-text"
          }`}
        >
          Manual Claim Submission
        </button>
      </div>

      {activeTab === "automated" && (
        <>
          {loading ? (
            <div className="bg-surface border border-border rounded-xl p-6 text-text-dim">Loading claims...</div>
          ) : (
            <ClaimsBoard claims={claims} onRunAutomation={runAutomation} syncing={syncing} />
          )}
        </>
      )}

      {activeTab === "manual" && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <ClaimForm />
        </div>
      )}
    </div>
  );
}
