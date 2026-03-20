"use client";
import { useState } from "react";
import type { ClaimResult, RiskLevel } from "@/types/claim";
import RiskBadge from "./RiskBadge";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CasesTable({ claims }: { claims: ClaimResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<RiskLevel | "ALL">("ALL");

  const filtered = filter === "ALL" ? claims : claims.filter((c) => c.risk_level === filter);

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
              filter === f
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-surface border-border text-text-dim hover:text-text"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {["ID", "Type", "Amount ($)", "Risk", "Score", "Date", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-text-dim uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((claim) => (
              <>
                <tr
                  key={claim.id}
                  onClick={() => setExpanded(expanded === claim.id ? null : claim.id)}
                  className="border-b border-border hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">{claim.id}</td>
                  <td className="px-4 py-3 text-text font-medium">{claim.incident_type}</td>
                  <td className="px-4 py-3 text-text">${claim.total_claim_amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><RiskBadge level={claim.risk_level} /></td>
                  <td className="px-4 py-3 font-mono text-accent">{claim.risk_score}</td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {new Date(claim.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-text-dim">
                    {expanded === claim.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                </tr>
                {expanded === claim.id && (
                  <tr key={`${claim.id}-exp`} className="bg-background border-b border-border">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Fraud Probability</p>
                          <p className="text-text font-semibold text-accent">{(claim.fraud_probability * 100).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Severity</p>
                          <p className="text-text">{claim.incident_severity}</p>
                        </div>
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Police Report</p>
                          <p className="text-text">{claim.police_report_available}</p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-text-dim font-mono uppercase mb-1">Recommendation</p>
                          <p className="text-text">{claim.recommendation}</p>
                        </div>
                        {claim.flags.length > 0 && (
                          <div className="md:col-span-3">
                            <p className="text-text-dim font-mono uppercase mb-1">Flags</p>
                            {claim.flags.map((f) => (
                              <p key={f} className="text-red-400 text-xs">• {f}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}