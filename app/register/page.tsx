"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="text-accent" size={24} />
          <span className="font-bold text-xl font-mono">
            SENTINEL<span className="text-accent">AI</span>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-text mb-1">Create account</h1>
        <p className="text-text-dim text-sm mb-6">Join the platform to submit and track claims</p>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {(["name", "email", "password"] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">
                {field}
              </label>
              <input
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
                placeholder={field === "email" ? "you@example.com" : field === "password" ? "••••••••" : "Your name"}
              />
            </div>
          ))}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : "Create account"}
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