"use client";

import { Loader2, ShieldCheck, Zap, Wallet } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import type { ClaimView } from "@/types/platform";

const statusClass: Record<string, string> = {
  PAID: "bg-green-950 text-green-300 border-green-800",
  REVIEW_REQUIRED: "bg-yellow-950 text-yellow-300 border-yellow-800",
  AUTO_INITIATED: "bg-blue-950 text-blue-300 border-blue-800",
  BLOCKED: "bg-red-950 text-red-300 border-red-800",
};

type Props = {
  claims: ClaimView[];
  onRunAutomation?: () => void;
  syncing?: boolean;
  compact?: boolean;
};

export default function ClaimsBoard({ claims, onRunAutomation, syncing, compact }: Props) {
  return (
    <div className="space-y-4">
      {onRunAutomation && (
        <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-4">
          <div>
            <p className="text-sm font-semibold text-text">Zero-touch claims automation</p>
            <p className="text-xs text-text-dim mt-1">
              Scan active disruptions, validate the trigger against your zone, and issue payouts instantly where risk is low.
            </p>
          </div>
          <button
            onClick={onRunAutomation}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Run protection scan
          </button>
        </div>
      )}

      {claims.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-text-dim">
          No income-loss claims yet. Trigger automation will create claims automatically when a disruption overlaps your operating zone.
        </div>
      ) : (
        claims.map((claim) => (
          <div key={claim.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-text">{claim.trigger.title}</p>
                <p className="text-xs text-text-dim mt-1">
                  {claim.trigger.city} · {claim.trigger.zone} · {new Date(claim.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RiskBadge level={claim.fraudLevel} />
                <span className={`px-2 py-1 rounded-lg border text-xs font-mono ${statusClass[claim.status]}`}>
                  {claim.status}
                </span>
              </div>
            </div>

            <div className={`grid gap-4 text-sm ${compact ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-4"}`}>
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs font-mono uppercase text-text-dim mb-2">Estimated income loss</p>
                <p className="text-xl font-semibold text-text">₹{claim.estimatedIncomeLoss}</p>
              </div>
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs font-mono uppercase text-text-dim mb-2">Approved payout</p>
                <p className="text-xl font-semibold text-green-300">₹{claim.approvedPayout}</p>
              </div>
              {!compact && (
                <div className="bg-background rounded-xl border border-border p-3">
                  <p className="text-xs font-mono uppercase text-text-dim mb-2">Fraud score</p>
                  <p className="text-xl font-semibold text-accent">{claim.fraudScore}</p>
                </div>
              )}
              {!compact && (
                <div className="bg-background rounded-xl border border-border p-3">
                  <p className="text-xs font-mono uppercase text-text-dim mb-2">Payout channel</p>
                  <p className="text-xl font-semibold text-text">{claim.payoutChannel}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs font-mono uppercase text-text-dim mb-2">Trigger summary</p>
                <p className="text-sm text-text">{claim.trigger.description}</p>
              </div>
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs font-mono uppercase text-text-dim mb-2">Validation result</p>
                <div className="flex items-start gap-2 text-sm text-text">
                  <ShieldCheck size={16} className="mt-0.5 text-green-300 shrink-0" />
                  <span>{claim.validationSummary}</span>
                </div>
              </div>
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs font-mono uppercase text-text-dim mb-2">Payout reference</p>
                <div className="flex items-start gap-2 text-sm text-text">
                  <Wallet size={16} className="mt-0.5 text-accent shrink-0" />
                  <span>{claim.payoutReference || "Pending manual validation"}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Fraud guardrails</p>
              <div className="flex flex-wrap gap-2">
                {claim.fraudFlags.map((flag) => (
                  <span key={flag} className="text-xs text-text-dim border border-border rounded-full px-3 py-1">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
