"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Siren, Wallet } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import type { AdminActionResponse, AdminOperationsResponse } from "@/types/platform";

const policyStatusClass: Record<string, string> = {
  ACTIVE: "bg-green-950 text-green-300 border-green-800",
  PAUSED: "bg-yellow-950 text-yellow-300 border-yellow-800",
  EXPIRED: "bg-red-950 text-red-300 border-red-800",
};

const claimStatusClass: Record<string, string> = {
  PAID: "bg-green-950 text-green-300 border-green-800",
  REVIEW_REQUIRED: "bg-yellow-950 text-yellow-300 border-yellow-800",
  AUTO_INITIATED: "bg-blue-950 text-blue-300 border-blue-800",
  BLOCKED: "bg-red-950 text-red-300 border-red-800",
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminOperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadData = async () => {
    const response = await fetch("/api/admin/operations");
    if (!response.ok) {
      setLoading(false);
      return;
    }

    const payload = await response.json();
    setData(payload);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
      return;
    }

    loadData();
  }, [session, status, router]);

  const runAction = async (key: string, body: object) => {
    setBusyKey(key);
    setActionError("");
    setActionMessage("");

    const response = await fetch("/api/admin/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      setActionError(payload.error || "Admin action failed.");
      setBusyKey(null);
      return;
    }

    const next = payload as AdminActionResponse;
    setData(next);
    setActionMessage(next.message);
    setBusyKey(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (!data) {
    return <div className="text-text-dim">Unable to load operations data.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Admin panel</p>
        <h1 className="text-3xl font-bold text-text">Platform operations center</h1>
        <p className="text-text-dim mt-1">
          Monitor the live insurance engine, control trigger automation, manage policy status, and make payout decisions on flagged claims.
        </p>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-mono text-text-dim uppercase mb-1">{metric.label}</p>
            <p className={`text-2xl font-bold ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-6">
        <section className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Siren size={16} className="text-orange-300" />
            <p className="text-sm font-semibold text-text">Trigger controls</p>
          </div>
          <div className="space-y-3">
            {data.activeTriggers.map((trigger) => (
              <div key={trigger.id} className="bg-background rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{trigger.title}</p>
                    <p className="text-xs text-text-dim mt-1">
                      {trigger.city} · {trigger.zone} · {trigger.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={trigger.severity} />
                    <span className={`px-2 py-1 rounded-lg border text-xs font-mono ${
                      trigger.isActive
                        ? "bg-green-950 text-green-300 border-green-800"
                        : "bg-zinc-900 text-zinc-300 border-zinc-700"
                    }`}>
                      {trigger.isActive ? "LIVE" : "OFF"}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-text-dim mt-3">{trigger.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                  <p className="text-xs text-text-dim">
                    {trigger.impactHours} disruption hours · {Math.round(trigger.payoutMultiplier * 100)}% payout intensity
                  </p>
                  <button
                    onClick={() => runAction(`trigger-${trigger.id}`, { entity: "trigger", id: trigger.id, isActive: !trigger.isActive })}
                    disabled={busyKey === `trigger-${trigger.id}`}
                    className="px-3 py-2 rounded-lg border border-border text-sm text-text hover:border-accent/40 disabled:opacity-50"
                  >
                    {busyKey === `trigger-${trigger.id}`
                      ? "Updating..."
                      : trigger.isActive
                        ? "Deactivate trigger"
                        : "Activate trigger"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-accent" />
            <p className="text-sm font-semibold text-text">Policy controls</p>
          </div>
          <div className="space-y-3">
            {data.policies.map((policy) => (
              <div key={policy.id} className="bg-background rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{policy.policyNumber}</p>
                    <p className="text-xs text-text-dim mt-1">
                      {policy.workerName} · {policy.workerEmail}
                    </p>
                    <p className="text-xs text-text-dim mt-1">
                      {policy.city} · {policy.zone} · {policy.platform}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={policy.riskLevel} />
                    <span className={`px-2 py-1 rounded-lg border text-xs font-mono ${policyStatusClass[policy.status] || policyStatusClass.PAUSED}`}>
                      {policy.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-xs font-mono uppercase text-text-dim mb-1">Weekly premium</p>
                    <p className="text-text">₹{policy.weeklyPremium}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase text-text-dim mb-1">Coverage</p>
                    <p className="text-text">₹{policy.weeklyCoverage}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => runAction(`policy-${policy.id}`, {
                      entity: "policy",
                      id: policy.id,
                      status: policy.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                    })}
                    disabled={busyKey === `policy-${policy.id}`}
                    className="px-3 py-2 rounded-lg border border-border text-sm text-text hover:border-accent/40 disabled:opacity-50"
                  >
                    {busyKey === `policy-${policy.id}`
                      ? "Updating..."
                      : policy.status === "ACTIVE"
                        ? "Pause policy"
                        : "Resume policy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-green-300" />
          <p className="text-sm font-semibold text-text">Claim review and payout decisions</p>
        </div>
        <div className="space-y-4">
          {data.claims.map((claim) => (
            <div key={claim.id} className="bg-background rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">{claim.trigger.title}</p>
                  <p className="text-xs text-text-dim mt-1">
                    {claim.workerName} · {claim.workerEmail} · {claim.policyNumber}
                  </p>
                  <p className="text-xs text-text-dim mt-1">
                    {claim.trigger.city} · {claim.trigger.zone} · {new Date(claim.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={claim.fraudLevel} />
                  <span className={`px-2 py-1 rounded-lg border text-xs font-mono ${claimStatusClass[claim.status] || claimStatusClass.REVIEW_REQUIRED}`}>
                    {claim.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-sm">
                <div>
                  <p className="text-xs font-mono uppercase text-text-dim mb-1">Income loss</p>
                  <p className="text-text">₹{claim.estimatedIncomeLoss}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-text-dim mb-1">Payout</p>
                  <p className="text-text">₹{claim.approvedPayout}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-text-dim mb-1">Fraud score</p>
                  <p className="text-text">{claim.fraudScore}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-text-dim mb-1">Reference</p>
                  <p className="text-text">{claim.payoutReference || "Pending"}</p>
                </div>
              </div>

              <p className="text-sm text-text-dim mt-4">{claim.validationSummary}</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {claim.fraudFlags.map((flag) => (
                  <span key={flag} className="text-xs text-text-dim border border-border rounded-full px-3 py-1">
                    {flag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 justify-end">
                <button
                  onClick={() => runAction(`claim-approve-${claim.id}`, { entity: "claim", id: claim.id, action: "APPROVE" })}
                  disabled={busyKey === `claim-approve-${claim.id}`}
                  className="px-3 py-2 rounded-lg bg-green-950 text-green-300 border border-green-800 text-sm disabled:opacity-50"
                >
                  {busyKey === `claim-approve-${claim.id}` ? "Approving..." : "Approve payout"}
                </button>
                <button
                  onClick={() => runAction(`claim-block-${claim.id}`, { entity: "claim", id: claim.id, action: "BLOCK" })}
                  disabled={busyKey === `claim-block-${claim.id}`}
                  className="px-3 py-2 rounded-lg bg-red-950 text-red-300 border border-red-800 text-sm disabled:opacity-50"
                >
                  {busyKey === `claim-block-${claim.id}` ? "Blocking..." : "Block claim"}
                </button>
                <button
                  onClick={() => runAction(`claim-reopen-${claim.id}`, { entity: "claim", id: claim.id, action: "REOPEN" })}
                  disabled={busyKey === `claim-reopen-${claim.id}`}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-text disabled:opacity-50"
                >
                  {busyKey === `claim-reopen-${claim.id}` ? "Updating..." : "Send to review"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
