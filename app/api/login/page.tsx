"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email, password, redirect: false,
    });
    setLoading(false);
    if (res?.error) return setError("Invalid email or password");
    router.push("/");
    router.refresh();
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
        <h1 className="text-2xl font-bold text-text mb-1">Sign in</h1>
        <p className="text-text-dim text-sm mb-6">Access your fraud detection dashboard</p>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-text-dim uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:outline-none focus:border-accent/60"
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : "Sign in"}
          </button>
        </div>

        <p className="text-center text-text-dim text-sm mt-6">
          No account?{" "}
          <Link href="/register" className="text-accent hover:underline">Register</Link>
        </p>
        <div className="mt-6 p-3 bg-background rounded-lg border border-border text-xs text-text-dim font-mono space-y-1">
          <p>Admin: admin@sentinel.ai / admin123</p>
          <p>User: user@sentinel.ai / user123</p>
        </div>
      </div>
    </div>
  );
}