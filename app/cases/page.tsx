"use client";

import { useEffect, useState } from "react";
import type { ClaimResult, ClaimStatus } from "@/types/claim";
import RiskBadge from "@/components/RiskBadge";

const statusClass: Record<ClaimStatus, string> = {
  PENDING: "bg-yellow-950 text-yellow-300 border-yellow-800",
  INFO_REQUESTED: "bg-blue-950 text-blue-300 border-blue-800",
  APPROVED: "bg-green-950 text-green-300 border-green-800",
  REJECTED: "bg-red-950 text-red-300 border-red-800",
};

export default function CasesPage() {
  const [claims, setClaims] = useState<ClaimResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [extraDescriptions, setExtraDescriptions] = useState<Record<string, string>>({});

  const loadClaims = async () => {
    const response = await fetch("/api/analyze-claim");
    if (!response.ok) {
      setLoading(false);
      return;
    }

    const data = await response.json();
    setClaims(data);
    setLoading(false);
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const submitAdditionalDescription = async (claimId: string) => {
    const additionalDescription = (extraDescriptions[claimId] || "").trim();
    if (!additionalDescription) return;

    setUpdatingId(claimId);
    const response = await fetch("/api/analyze-claim", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, additionalDescription }),
    });

    if (response.ok) {
      await loadClaims();
      setExtraDescriptions((prev) => ({ ...prev, [claimId]: "" }));
    }

    setUpdatingId(null);
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">My Claims</p>
        <h1 className="text-3xl font-bold text-text">Review Queue & Results</h1>
        <p className="text-text-dim mt-2">Track each claim status, admin notes, and final outcomes.</p>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-text-dim">Loading claims...</div>
      ) : claims.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-text-dim">No claims submitted yet.</div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const status = (claim.status || "PENDING") as ClaimStatus;
            return (
              <div key={claim.id} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm text-text font-semibold">{claim.incident_type}</p>
                    <p className="text-xs text-text-dim">{new Date(claim.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={claim.risk_level} />
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${statusClass[status]}`}>
                      {status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-3">
                  <div>
                    <p className="text-text-dim font-mono uppercase mb-1">Total Claim</p>
                    <p className="text-text font-semibold">${claim.total_claim_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-text-dim font-mono uppercase mb-1">Fraud Probability</p>
                    <p className="text-text font-semibold">{(claim.fraud_probability * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-text-dim font-mono uppercase mb-1">AI Recommendation</p>
                    <p className="text-text">{claim.recommendation}</p>
                  </div>
                </div>

                {claim.infoRequestNote && (
                  <div className="bg-blue-950/50 border border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-200 mb-3">
                    Admin requested more details: {claim.infoRequestNote}
                  </div>
                )}

                {claim.adminNote && (
                  <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-dim mb-3">
                    Admin note: <span className="text-text">{claim.adminNote}</span>
                  </div>
                )}

                {status === "INFO_REQUESTED" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-mono text-text-dim uppercase">Additional Description</p>
                    <textarea
                      className="w-full min-h-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
                      placeholder="Provide additional details requested by admin..."
                      value={extraDescriptions[claim.id] || ""}
                      onChange={(e) =>
                        setExtraDescriptions((prev) => ({ ...prev, [claim.id]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => submitAdditionalDescription(claim.id)}
                      disabled={updatingId === claim.id || !(extraDescriptions[claim.id] || "").trim()}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      {updatingId === claim.id ? "Submitting..." : "Submit Additional Description"}
                    </button>
                  </div>
                )}

                {claim.additionalDescription && status !== "INFO_REQUESTED" && (
                  <div className="mt-3 bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-dim">
                    Your additional description: <span className="text-text">{claim.additionalDescription}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
