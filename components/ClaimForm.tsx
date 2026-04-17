"use client";
import { useState } from "react";
import type { ClaimInput, ClaimResult } from "@/types/claim";
import RiskGauge from "./RiskGauge";
import RiskBadge from "./RiskBadge";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60 transition-colors";
const labelClass = "block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5";

export default function ClaimForm() {
  const [form, setForm] = useState<Partial<ClaimInput>>({
    umbrella_limit: 0,
    bodily_injuries: 0,
    capital_gains: 0,
    capital_loss: 0,
    policy_deductable: 1000,
    auto_year: 2020,
  });
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof ClaimInput, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const monthsAsCustomer = (() => {
    if (!form.policy_bind_date) return 0;
    const bindDate = new Date(form.policy_bind_date);
    if (Number.isNaN(bindDate.getTime())) return 0;

    const now = new Date();
    let months = (now.getFullYear() - bindDate.getFullYear()) * 12;
    months += now.getMonth() - bindDate.getMonth();
    if (now.getDate() < bindDate.getDate()) months -= 1;
    return Math.max(0, months);
  })();

  const totalClaimAmount =
    toNumber(form.injury_claim) + toNumber(form.property_claim) + toNumber(form.vehicle_claim);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    // Basic validation
    if (!form.age || !form.policy_bind_date || !form.policy_annual_premium) {
      setError("Please fill in required fields: Age, Policy Bind Date, and Policy Annual Premium.");
      setLoading(false);
      return;
    }

    if (!form.incident_type || !form.collision_type || !form.incident_severity) {
      setError("Please select incident details.");
      setLoading(false);
      return;
    }

    if (totalClaimAmount === 0) {
      setError("Please enter claim amounts.");
      setLoading(false);
      return;
    }

    const payload = {
      months_as_customer: monthsAsCustomer,
      age: toNumber(form.age) || 30,
      policy_bind_date: form.policy_bind_date,
      policy_annual_premium: toNumber(form.policy_annual_premium) || 1000,
      umbrella_limit: toNumber(form.umbrella_limit) || 0,
      incident_type: form.incident_type || "Single Vehicle Collision",
      collision_type: form.collision_type || "Front Collision",
      incident_severity: form.incident_severity || "Minor Damage",
      authorities_contacted: form.authorities_contacted || "Police",
      incident_hour_of_the_day: toNumber(form.incident_hour_of_the_day) || 12,
      number_of_vehicles_involved: toNumber(form.number_of_vehicles_involved) || 1,
      property_damage: form.property_damage || "NO",
      bodily_injuries: toNumber(form.bodily_injuries) || 0,
      witnesses: toNumber(form.witnesses) || 0,
      police_report_available: form.police_report_available || "NO",
      total_claim_amount: totalClaimAmount,
      injury_claim: toNumber(form.injury_claim) || 0,
      property_claim: toNumber(form.property_claim) || 0,
      vehicle_claim: toNumber(form.vehicle_claim) || 0,
      auto_year: toNumber(form.auto_year) || 2020,
      capital_gains: toNumber(form.capital_gains) || 0,
      capital_loss: toNumber(form.capital_loss) || 0,
      policy_deductable: toNumber(form.policy_deductable) || 1000,
    };

    try {
      const res = await fetch("/api/analyze-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "Failed to analyze claim");
        return;
      }
      const data: ClaimResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("Network error. Make sure the ML service is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-text">Claim Details</h2>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        {/* Customer & Policy Info */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-4">Customer & Policy</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Months as Customer</label>
              <input
                type="number"
                className={`${inputClass} opacity-80`}
                value={monthsAsCustomer}
                readOnly
              />
            </div>
            <div>
              <label className={labelClass}>Age</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("age", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Policy Bind Date</label>
              <input type="date" className={inputClass}
                onChange={(e) => set("policy_bind_date", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Policy Annual Premium ($)</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("policy_annual_premium", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Umbrella Limit ($)</label>
              <input type="number" className={inputClass} placeholder="0" defaultValue={0}
                onChange={(e) => set("umbrella_limit", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Policy Deductable ($)</label>
              <input type="number" className={inputClass} placeholder="1000" defaultValue={1000}
                onChange={(e) => set("policy_deductable", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Vehicle & Incident Info */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-4">Vehicle & Incident</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Auto Year</label>
              <input type="number" className={inputClass} placeholder="2020" defaultValue={2020}
                onChange={(e) => set("auto_year", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Incident Type</label>
              <select className={inputClass} onChange={(e) => set("incident_type", e.target.value)}>
                <option value="">Select type</option>
                <option value="Single Vehicle Collision">Single Vehicle Collision</option>
                <option value="Multi Vehicle Collision">Multi Vehicle Collision</option>
                <option value="Vehicle Theft">Vehicle Theft</option>
                <option value="Parked Car">Parked Car</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Collision Type</label>
              <select className={inputClass} onChange={(e) => set("collision_type", e.target.value)}>
                <option value="">Select type</option>
                <option value="Front Collision">Front Collision</option>
                <option value="Rear Collision">Rear Collision</option>
                <option value="Side Collision">Side Collision</option>
                <option value="Rollover">Rollover</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Incident Severity</label>
              <select className={inputClass} onChange={(e) => set("incident_severity", e.target.value)}>
                <option value="">Select severity</option>
                <option value="Minor Damage">Minor Damage</option>
                <option value="Moderate Damage">Moderate Damage</option>
                <option value="Major Damage">Major Damage</option>
                <option value="Total Loss">Total Loss</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Incident Hour</label>
              <input type="number" className={inputClass} min="0" max="23" placeholder="Hour (0-23)"
                onChange={(e) => set("incident_hour_of_the_day", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Vehicles Involved</label>
              <input type="number" className={inputClass} placeholder="1"
                onChange={(e) => set("number_of_vehicles_involved", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Claim Amount Breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-4">Claim Amount Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Total Claim Amount ($)</label>
              <input
                type="number"
                className={`${inputClass} opacity-80`}
                value={totalClaimAmount}
                readOnly
              />
            </div>
            <div>
              <label className={labelClass}>Injury Claim ($)</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("injury_claim", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Property Claim ($)</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("property_claim", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Vehicle Claim ($)</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("vehicle_claim", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Claim Details */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-4">Claim Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Property Damage</label>
              <select className={inputClass} onChange={(e) => set("property_damage", e.target.value)}>
                <option value="">Select</option>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
                <option value="?">Unknown</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Bodily Injuries</label>
              <input type="number" className={inputClass} placeholder="0" defaultValue={0}
                onChange={(e) => set("bodily_injuries", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Witnesses</label>
              <input type="number" className={inputClass} placeholder="0"
                onChange={(e) => set("witnesses", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Police Report Available</label>
              <select className={inputClass} onChange={(e) => set("police_report_available", e.target.value)}>
                <option value="">Select</option>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
                <option value="?">Unknown</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Authorities Contacted</label>
              <select className={inputClass} onChange={(e) => set("authorities_contacted", e.target.value)}>
                <option value="">Select</option>
                <option value="Police">Police</option>
                <option value="Fire">Fire</option>
                <option value="Ambulance">Ambulance</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Capital Gains/Losses */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-4">Financial</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Capital Gains ($)</label>
              <input type="number" className={inputClass} placeholder="0" defaultValue={0}
                onChange={(e) => set("capital_gains", Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Capital Loss ($)</label>
              <input type="number" className={inputClass} placeholder="0" defaultValue={0}
                onChange={(e) => set("capital_loss", Number(e.target.value))} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : "Analyze Claim"}
        </button>
      </div>

      {/* Result Panel */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center justify-start gap-5 max-h-[90vh] overflow-y-auto">
        {!result ? (
          <div className="text-center mt-12 text-text-dim">
            <p className="text-sm">Submit a claim to see the AI fraud detection analysis.</p>
          </div>
        ) : (
          <>
            <RiskGauge score={result.risk_score} />
            <RiskBadge level={result.risk_level} />
            <div className="w-full">
              <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-2">Fraud Probability</p>
              <p className="text-sm text-accent font-semibold">
                {(result.fraud_probability * 100).toFixed(2)}%
              </p>
            </div>
            <div className="w-full">
              <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-2">Recommendation</p>
              <p className="text-sm text-text bg-background rounded-lg p-3 border border-border">
                {result.recommendation}
              </p>
            </div>
            {result.flags.length > 0 && (
              <div className="w-full">
                <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-2">Flags Triggered</p>
                <ul className="space-y-1.5">
                  {result.flags.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-red-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.flags.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} /> No fraud signals detected
              </div>
            )}
            <p className="text-xs text-text-dim font-mono">ID: {result.id}</p>
          </>
        )}
      </div>
    </div>
  );
}