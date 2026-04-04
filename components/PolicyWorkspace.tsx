"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, Shield, Siren, Sparkles, Wallet } from "lucide-react";
import ClaimsBoard from "@/components/ClaimsBoard";
import RiskBadge from "@/components/RiskBadge";
import RiskGauge from "@/components/RiskGauge";
import type { PolicyContextResponse } from "@/types/platform";

export default function PolicyWorkspace() {
  const [data, setData] = useState<PolicyContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPolicy, setSyncingPolicy] = useState(false);
  const [syncingClaims, setSyncingClaims] = useState(false);
  const [simulatingClaim, setSimulatingClaim] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/policy");
    if (!response.ok) {
      setLoading(false);
      return;
    }

    const payload = await response.json();
    setData(payload);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshPricing = async () => {
    setSyncingPolicy(true);
    setMessage("");
    const response = await fetch("/api/policy", { method: "POST" });
    if (response.ok) {
      const payload = await response.json();
      setData(payload);
      setMessage("Weekly premium refreshed using the latest zone risk and exposure profile.");
    }
    setSyncingPolicy(false);
  };

  const runAutomation = async () => {
    setSyncingClaims(true);
    setMessage("");
    const response = await fetch("/api/claims", { method: "POST" });
    if (response.ok) {
      const payload = await response.json();
      await load();
      setMessage(
        payload.created > 0
          ? `${payload.created} claim${payload.created > 1 ? "s" : ""} auto-created from live disruption triggers.`
          : "No new claims were needed. Existing triggers are already covered.",
      );
    }
    setSyncingClaims(false);
  };

  const simulateAutomation = async () => {
    setSimulatingClaim(true);
    setMessage("");
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "simulate" }),
    });

    if (response.ok) {
      const payload = await response.json();
      await load();
      setMessage(
        payload.created > 0
          ? `Demo trigger created and ${payload.created} zero-touch claim${payload.created > 1 ? "s" : ""} auto-generated.`
          : "Demo trigger created, but no new claim was needed.",
      );
    }

    setSimulatingClaim(false);
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-10 flex items-center justify-center text-text-dim">
        <Loader2 className="animate-spin mr-3" size={18} />
        Loading worker coverage...
      </div>
    );
  }

  if (!data?.profile || !data.policy) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8">
        <p className="text-lg font-semibold text-text">Complete onboarding to create your weekly income protection policy.</p>
        <p className="text-text-dim mt-2">Registration creates a worker profile, predicts zone risk, and issues the first weekly quote automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-surface border border-border rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-accent mb-2">Weekly income protection</p>
              <h2 className="text-3xl font-bold text-text">Policy management</h2>
              <p className="text-text-dim mt-2 max-w-2xl">
                This policy only covers loss of income caused by external disruptions such as rain, flooding, pollution,
                heat, or zone closures. It does not cover health, life, accidents, or vehicle repair costs.
              </p>
            </div>
            <button
              onClick={refreshPricing}
              disabled={syncingPolicy}
              className="px-4 py-2 rounded-xl border border-border bg-background text-sm text-text hover:border-accent/40 disabled:opacity-50 flex items-center gap-2"
            >
              {syncingPolicy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Refresh weekly pricing
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-background rounded-2xl border border-border p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Policy number</p>
              <p className="text-lg font-semibold text-text">{data.policy.policyNumber}</p>
              <p className="text-sm text-text-dim mt-2">{data.profile.platform} · {data.profile.vehicleType}</p>
            </div>
            <div className="bg-background rounded-2xl border border-border p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Weekly premium</p>
              <p className="text-3xl font-bold text-accent">₹{data.policy.weeklyPremium}</p>
              <p className="text-sm text-text-dim mt-2">Billed on the worker&apos;s weekly earnings cycle.</p>
            </div>
            <div className="bg-background rounded-2xl border border-border p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Max protected income</p>
              <p className="text-3xl font-bold text-green-300">₹{data.policy.weeklyCoverage}</p>
              <p className="text-sm text-text-dim mt-2">Coverage for up to {data.policy.coverageHours} lost delivery hours.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 mt-6">
            <div className="bg-background rounded-2xl border border-border p-5 flex flex-col items-center">
              <RiskGauge score={data.policy.riskScore} />
              <div className="mt-4">
                <RiskBadge level={data.policy.riskLevel} />
              </div>
              <p className="text-xs text-text-dim text-center mt-4">
                Risk profile is recalculated from zone exposure, platform intensity, rider hours, and historical disruption patterns.
              </p>
            </div>

            <div className="bg-background rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={16} className="text-accent" />
                <p className="text-sm font-semibold text-text">Dynamic premium breakdown</p>
              </div>
              <div className="space-y-3">
                {data.policy.pricingBreakdown.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 border-b border-border/60 pb-3">
                    <div>
                      <p className="text-sm font-medium text-text">{item.label}</p>
                      <p className="text-xs text-text-dim mt-1">{item.note}</p>
                    </div>
                    <p className={`text-sm font-semibold ${item.direction === "SUBTRACT" ? "text-green-300" : "text-text"}`}>
                      {item.direction === "SUBTRACT" ? "-" : "+"}₹{item.amount}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-accent" />
            <p className="text-sm font-semibold text-text">Worker profile</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-xs font-mono uppercase text-text-dim mb-1">Operating zone</p>
              <p className="text-text">{data.profile.city} · {data.profile.zone}</p>
            </div>
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-xs font-mono uppercase text-text-dim mb-1">Weekly income</p>
              <p className="text-text">₹{data.profile.weeklyIncome}</p>
            </div>
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-xs font-mono uppercase text-text-dim mb-1">Work pattern</p>
              <p className="text-text">{data.profile.avgHoursPerDay} hrs/day · {data.profile.workDaysPerWeek} days/week</p>
            </div>
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-xs font-mono uppercase text-text-dim mb-1">Payout channel</p>
              <p className="text-text">{data.policy.payoutChannel} · {data.profile.upiId}</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Siren size={16} className="text-orange-300" />
              <p className="text-sm font-semibold text-text">Active triggers</p>
            </div>
            <div className="space-y-3">
              {data.activeTriggers.length === 0 ? (
                <div className="bg-background rounded-xl border border-border p-3 text-sm text-text-dim">
                  No active disruptions in this zone right now.
                </div>
              ) : (
                data.activeTriggers.map((trigger) => (
                  <div key={trigger.id} className="bg-background rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-text">{trigger.title}</p>
                      <RiskBadge level={trigger.severity} />
                    </div>
                    <p className="text-xs text-text-dim mt-2">{trigger.description}</p>
                    <p className="text-xs text-orange-300 mt-2">
                      {trigger.impactHours} disruption hours · {Math.round(trigger.payoutMultiplier * 100)}% payout intensity
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ClaimsBoard
        claims={data.recentClaims}
        onRunAutomation={runAutomation}
        syncing={syncingClaims}
        compact
      />

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">Need something visual for the demo?</p>
          <p className="text-xs text-text-dim mt-1">
            Create a fresh mock disruption in this worker&apos;s zone and instantly showcase zero-touch claim automation.
          </p>
        </div>
        <button
          onClick={simulateAutomation}
          disabled={simulatingClaim}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
        >
          {simulatingClaim ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Simulate demo disruption
        </button>
      </div>
    </div>
  );
}
