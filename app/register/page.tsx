"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { cityZones, platformOptions, vehicleOptions } from "@/lib/platformCatalog";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    city: cityZones[0].city,
    zone: cityZones[0].zones[0],
    platform: platformOptions[0],
    vehicleType: vehicleOptions[0],
    weeklyIncome: 5500,
    avgHoursPerDay: 8,
    workDaysPerWeek: 6,
    upiId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Registration failed");
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    router.push("/");
    router.refresh();
  };

  const zonesForCity = cityZones.find((entry) => entry.city === form.city)?.zones ?? cityZones[0].zones;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-8">
      <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="text-accent" size={24} />
          <span className="font-bold text-xl font-mono">
            SENTINEL<span className="text-accent">AI</span>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-text mb-1">Worker onboarding</h1>
        <p className="text-text-dim text-sm mb-6">
          Create a delivery-worker profile, calculate your weekly premium, and activate income protection in one flow.
        </p>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="Worker name"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="+91 98xxxxxx"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Delivery platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            >
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Vehicle type</label>
            <select
              value={form.vehicleType}
              onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            >
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle} value={vehicle}>{vehicle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">City</label>
            <select
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value, zone: cityZones.find((entry) => entry.city === e.target.value)?.zones[0] || "" }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            >
              {cityZones.map((entry) => (
                <option key={entry.city} value={entry.city}>{entry.city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Operating zone</label>
            <select
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            >
              {zonesForCity.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Weekly income (₹)</label>
            <input
              type="number"
              value={form.weeklyIncome}
              onChange={(e) => setForm((f) => ({ ...f, weeklyIncome: Number(e.target.value) }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Average hours per day</label>
            <input
              type="number"
              value={form.avgHoursPerDay}
              onChange={(e) => setForm((f) => ({ ...f, avgHoursPerDay: Number(e.target.value) }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Work days per week</label>
            <input
              type="number"
              value={form.workDaysPerWeek}
              onChange={(e) => setForm((f) => ({ ...f, workDaysPerWeek: Number(e.target.value) }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">UPI ID</label>
            <input
              type="text"
              value={form.upiId}
              onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="worker@upi"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-xs font-mono uppercase text-text-dim mb-2">Predicted outcome</p>
            <p className="text-sm text-text">An active weekly policy is created immediately after onboarding.</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-xs font-mono uppercase text-text-dim mb-2">Fraud controls</p>
            <p className="text-sm text-text">Location and duplicate-claim validation are enabled from day one.</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4">
            <p className="text-xs font-mono uppercase text-text-dim mb-2">Payout method</p>
            <p className="text-sm text-text">Auto-approved payouts are issued through the worker&apos;s UPI channel.</p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Activating policy...</> : "Create profile and activate weekly cover"}
          </button>
        </div>

        <p className="text-center text-text-dim text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
