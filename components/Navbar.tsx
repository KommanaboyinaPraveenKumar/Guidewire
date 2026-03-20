"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const links = [
    { href: "/", label: "Submit Claim" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/cases", label: "My Cases" },
    ...(session?.user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="text-accent" size={20} />
          <span className="font-bold text-text font-mono tracking-tight">
            SENTINEL<span className="text-accent">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {session && links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                path === l.href
                  ? "bg-accent/10 text-accent border border-accent/30"
                  : "text-text-dim hover:text-text hover:bg-white/5"
              }`}>
              {l.label}
            </Link>
          ))}
          {session ? (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <span className="text-xs text-text-dim font-mono">{session.user.email}</span>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="ml-4 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}