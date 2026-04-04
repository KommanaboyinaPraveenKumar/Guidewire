"use client";

import Link from "next/link";
import { Shield, Siren, Wallet, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PolicyWorkspace from "@/components/PolicyWorkspace";

const highlights = [
  {
    title: "Weekly pricing model",
    description: "Premiums are quoted weekly so they match how gig workers usually earn and cash out.",
    icon: Wallet,
  },
  {
    title: "Zero-touch parametric claims",
    description: "The system watches trigger feeds, opens claims automatically, and pays out where fraud risk is low.",
    icon: Zap,
  },
  {
    title: "Fraud-aware automation",
    description: "Every payout is checked for zone alignment, duplicate claim patterns, and abnormal payout behavior.",
    icon: Shield,
  },
  {
    title: "Disruption monitoring",
    description: "Mock weather, pollution, and zone closure feeds simulate live trigger monitoring for worker income loss.",
    icon: Siren,
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "loading" && session?.user?.role === "ADMIN") {
      router.replace("/admin");
    }
  }, [router, session, status]);

  if (status === "loading") {
    return <div className="text-text-dim">Loading platform...</div>;
  }

  if (session?.user?.role === "ADMIN") {
    return <div className="text-text-dim">Opening admin operations...</div>;
  }

  if (session) {
    return <PolicyWorkspace />;
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-surface px-8 py-12 md:px-12">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(232,75,58,0.22),_transparent_55%)] pointer-events-none" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-accent mb-4">SentinelAI</p>
          <h1 className="text-4xl md:text-6xl font-bold text-text leading-tight">
            AI-powered income protection for India&apos;s gig workforce
          </h1>
          <p className="text-lg text-text-dim mt-5 max-w-2xl">
            Protect delivery partners against income loss caused by rain, flooding, pollution, heat, and sudden zone closures,
            with weekly pricing and instant parametric payouts.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/register"
              className="px-5 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-red-600 transition-colors"
            >
              Start worker onboarding
            </Link>
            <Link
              href="/login"
              className="px-5 py-3 rounded-xl border border-border text-text font-semibold hover:border-accent/40 transition-colors"
            >
              View demo account
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            <div className="bg-background/70 border border-border rounded-2xl p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Coverage scope</p>
              <p className="text-sm text-text">Income loss only. No health, life, accident, or vehicle repair payouts.</p>
            </div>
            <div className="bg-background/70 border border-border rounded-2xl p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Automation</p>
              <p className="text-sm text-text">3-5 live or mock triggers can open claims automatically without worker effort.</p>
            </div>
            <div className="bg-background/70 border border-border rounded-2xl p-4">
              <p className="text-xs font-mono uppercase text-text-dim mb-2">Pricing cadence</p>
              <p className="text-sm text-text">Weekly premium and weekly coverage keep the model aligned to gig earnings cycles.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {highlights.map(({ title, description, icon: Icon }) => (
          <div key={title} className="bg-surface border border-border rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
              <Icon size={18} />
            </div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <p className="text-sm text-text-dim mt-2">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
