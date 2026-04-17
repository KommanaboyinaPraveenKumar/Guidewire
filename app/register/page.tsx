"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { cityZones, platformOptions, vehicleOptions } from "@/lib/platformCatalog";

export default function RegisterPage() {
  const upiPattern = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/;
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
  const [availableCities, setAvailableCities] = useState<string[]>(
    cityZones.map((entry) => entry.city),
  );
  const [availableZones, setAvailableZones] = useState<string[]>(cityZones[0].zones);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [customZoneMode, setCustomZoneMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadCities = async () => {
      try {
        const response = await fetch("/api/location/cities", { cache: "no-store" });
        const payload = (await response.json()) as { cities?: string[] };

        if (!active || !Array.isArray(payload.cities) || payload.cities.length === 0) {
          return;
        }

        const cities = payload.cities;

        setAvailableCities(cities);
        setForm((f) => {
          if (cities.includes(f.city)) return f;
          return { ...f, city: cities[0] ?? f.city, zone: "" };
        });
      } catch {
        // Falls back to default seeded cities already in state.
      } finally {
        if (active) setCitiesLoading(false);
      }
    };

    void loadCities();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadZones = async () => {
      const city = form.city.trim();
      if (!city) {
        setAvailableZones([]);
        setCustomZoneMode(true);
        return;
      }

      setZonesLoading(true);
      try {
        const response = await fetch(`/api/location/zones?city=${encodeURIComponent(city)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { zones?: string[] };
        const zones = Array.isArray(payload.zones) ? payload.zones : [];

        if (!active) return;

        setAvailableZones(zones);
        setCustomZoneMode(zones.length === 0);

        if (zones.length === 0) return;

        setForm((f) => {
          const alreadySelected = zones.some((zone) => zone.toLowerCase() === f.zone.trim().toLowerCase());
          if (alreadySelected && f.zone.trim()) return f;
          return { ...f, zone: zones[0] };
        });
      } catch {
        if (!active) return;
        setAvailableZones([]);
        setCustomZoneMode(true);
      } finally {
        if (active) setZonesLoading(false);
      }
    };

    void loadZones();

    return () => {
      active = false;
    };
  }, [form.city]);

  const handleRegister = async () => {
    const payload = {
      ...form,
      city: form.city.trim(),
      zone: form.zone.trim(),
      upiId: form.upiId.trim(),
    };

    if (!payload.city || !payload.zone) {
      setError("City and operating zone are required.");
      return;
    }

    if (!upiPattern.test(payload.upiId)) {
      setError("Enter a valid UPI ID (example: worker@oksbi).");
      return;
    }

    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              disabled={citiesLoading}
            >
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Operating zone</label>
            {!customZoneMode ? (
              <>
                <select
                  value={form.zone}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomZoneMode(true);
                      setForm((f) => ({ ...f, zone: "" }));
                      return;
                    }
                    setForm((f) => ({ ...f, zone: e.target.value }));
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
                  disabled={zonesLoading}
                >
                  {availableZones.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                  <option value="__custom__">Not listed - enter manually</option>
                </select>
              </>
            ) : (
              <input
                type="text"
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
                placeholder="Area / locality"
              />
            )}
            {customZoneMode ? (
              <button
                type="button"
                onClick={() => {
                  if (availableZones.length === 0) return;
                  setCustomZoneMode(false);
                  setForm((f) => ({ ...f, zone: availableZones[0] }));
                }}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Switch back to zone dropdown
              </button>
            ) : null}
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
            <p className="mt-1 text-[11px] text-text-dim">Required for instant payout simulation (example: worker@oksbi).</p>
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
