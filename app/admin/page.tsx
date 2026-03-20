"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RiskBadge from "@/components/RiskBadge";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface AdminClaim {
  id: string;
  claimType: string;
  amount: number;
  location: string;
  description: string;
  riskScore: number;
  riskLevel: string;
  flags: string[];
  recommendation: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.push("/");
      return;
    }
    fetch("/api/admin/claims")
      .then((r) => r.json())
      .then((d) => { setClaims(d); setLoading(false); });
  }, [session, status, router]);

  const handleAction = async (claimId: string, newStatus: "APPROVED" | "REJECTED") => {
    setUpdating(claimId);
    await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, status: newStatus, adminNote: notes[claimId] || "" }),
    });
    setClaims((prev) =>
      prev.map((c) => c.id === claimId ? { ...c, status: newStatus, adminNote: notes[claimId] || null } : c)
    );
    setUpdating(null);
  };

  const filtered = filter === "ALL" ? claims : claims.filter((c) => c.status === filter);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-accent" size={32} />
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Admin Panel</p>
        <h1 className="text-3xl font-bold text-text">Claim Review</h1>
        <p className="text-text-dim mt-1">{claims.length} total claims · Model retrains every 10 resolved</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: claims.length, color: "text-text" },
          { label: "Pending", value: claims.filter((c) => c.status === "PENDING").length, color: "text-yellow-400" },
          { label: "Approved", value: claims.filter((c) => c.status === "APPROVED").length, color: "text-green-400" },
          { label: "Rejected", value: claims.filter((c) => c.status === "REJECTED").length, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-mono text-text-dim uppercase mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
              filter === f ? "bg-accent/10 border-accent/40 text-accent" : "bg-surface border-border text-text-dim hover:text-text"
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {["Claimant", "Type", "Amount", "Risk", "Score", "Status", "Date", "Actions", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-text-dim uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((claim) => (
              <>
                <tr key={claim.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-text font-medium">{claim.user.name}</p>
                    <p className="text-text-dim text-xs">{claim.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-text-dim">{claim.claimType}</td>
                  <td className="px-4 py-3 text-text">₹{claim.amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><RiskBadge level={claim.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} /></td>
                  <td className="px-4 py-3 font-mono text-accent">{Math.round(claim.riskScore)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${
                      claim.status === "APPROVED" ? "bg-green-950 text-green-400 border-green-800" :
                      claim.status === "REJECTED" ? "bg-red-950 text-red-400 border-red-800" :
                      "bg-yellow-950 text-yellow-400 border-yellow-800"
                    }`}>{claim.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {claim.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(claim.id, "APPROVED")}
                          disabled={!!updating}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-green-950 hover:bg-green-900 text-green-400 text-xs border border-green-800 transition-colors disabled:opacity-50"
                        >
                          {updating === claim.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(claim.id, "REJECTED")}
                          disabled={!!updating}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-400 text-xs border border-red-800 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={10} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setExpanded(expanded === claim.id ? null : claim.id)} className="text-text-dim hover:text-text">
                      {expanded === claim.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                </tr>
                {expanded === claim.id && (
                  <tr key={`${claim.id}-exp`} className="bg-background border-b border-border">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Description</p>
                          <p className="text-text">{claim.description}</p>
                        </div>
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Flags</p>
                          {claim.flags.length === 0
                            ? <p className="text-green-400">None</p>
                            : claim.flags.map((f) => <p key={f} className="text-red-400">• {f}</p>)}
                        </div>
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Recommendation</p>
                          <p className="text-text">{claim.recommendation}</p>
                        </div>
                      </div>
                      {claim.status === "PENDING" && (
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <p className="text-text-dim font-mono text-xs uppercase mb-1">Admin Note</p>
                            <input
                              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-xs focus:outline-none focus:border-accent/60"
                              placeholder="Optional note..."
                              value={notes[claim.id] || ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [claim.id]: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                      {claim.adminNote && (
                        <p className="text-xs text-text-dim mt-2">Admin note: <span className="text-text">{claim.adminNote}</span></p>
                      )}
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