"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import RiskBadge from "@/components/RiskBadge";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface AdminClaim {
  id: string;
  incidentType: string;
  incidentSeverity: string;
  amount: number;
  authoritiesContacted: string;
  riskScore: number;
  riskLevel: string;
  flags: string[];
  recommendation: string;
  status: string;
  adminNote: string | null;
  infoRequestNote: string | null;
  additionalDescription: string | null;
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
    fetch("/api/analyze-claim/admin/claims")
      .then((r) => r.json())
      .then((d) => { setClaims(d); setLoading(false); });
  }, [session, status, router]);

  const handleAction = async (claimId: string, action: "APPROVE" | "REJECT" | "REQUEST_INFO") => {
    setUpdating(claimId);
    const response = await fetch("/api/analyze-claim/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId,
        action,
        adminNote: notes[claimId] || "",
        infoRequestNote: notes[claimId] || "",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setUpdating(null);
      return;
    }

    setClaims((prev) =>
      prev.map((c) => c.id === claimId
        ? {
            ...c,
            status: data.status,
            adminNote: data.adminNote,
            infoRequestNote: data.infoRequestNote,
          }
        : c)
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
          { label: "Pending", value: claims.filter((c) => c.status === "PENDING").length, color: "text-yellow-300" },
          { label: "Info Requested", value: claims.filter((c) => c.status === "INFO_REQUESTED").length, color: "text-blue-300" },
          { label: "Approved", value: claims.filter((c) => c.status === "APPROVED").length, color: "text-green-300" },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-mono text-text-dim uppercase mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        {["ALL", "PENDING", "INFO_REQUESTED", "APPROVED", "REJECTED"].map((f) => (
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
              <Fragment key={claim.id}>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-text font-medium">{claim.user.name}</p>
                    <p className="text-text-dim text-xs">{claim.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-text-dim">{claim.incidentType}</td>
                  <td className="px-4 py-3 text-text">₹{claim.amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><RiskBadge level={claim.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} /></td>
                  <td className="px-4 py-3 font-mono text-accent">{Math.round(claim.riskScore)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${
                      claim.status === "APPROVED" ? "bg-green-950 text-green-400 border-green-800" :
                      claim.status === "REJECTED" ? "bg-red-950 text-red-400 border-red-800" :
                      claim.status === "INFO_REQUESTED" ? "bg-blue-950 text-blue-300 border-blue-800" :
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
                          onClick={() => handleAction(claim.id, "APPROVE")}
                          disabled={!!updating}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-green-950 hover:bg-green-900 text-green-400 text-xs border border-green-800 transition-colors disabled:opacity-50"
                        >
                          {updating === claim.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(claim.id, "REJECT")}
                          disabled={!!updating}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-400 text-xs border border-red-800 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={10} /> Reject
                        </button>
                        <button
                          onClick={() => handleAction(claim.id, "REQUEST_INFO")}
                          disabled={!!updating || !(notes[claim.id] || "").trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-950 hover:bg-blue-900 text-blue-300 text-xs border border-blue-800 transition-colors disabled:opacity-50"
                        >
                          Request Info
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
                          <p className="text-text-dim font-mono uppercase mb-1">Incident</p>
                          <p className="text-text">{claim.incidentType} · {claim.incidentSeverity}</p>
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
                      {(claim.status === "PENDING" || claim.status === "INFO_REQUESTED") && (
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <p className="text-text-dim font-mono text-xs uppercase mb-1">Admin Note / Info Request</p>
                            <input
                              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-xs focus:outline-none focus:border-accent/60"
                              placeholder="Reason or extra details requested from claimant..."
                              value={notes[claim.id] || ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [claim.id]: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">Authorities Contacted</p>
                          <p className="text-text">{claim.authoritiesContacted}</p>
                        </div>
                        <div>
                          <p className="text-text-dim font-mono uppercase mb-1">User Additional Description</p>
                          <p className="text-text">{claim.additionalDescription || "Not provided"}</p>
                        </div>
                      </div>
                      {claim.infoRequestNote && (
                        <p className="text-xs text-blue-300 mt-2">Requested info: {claim.infoRequestNote}</p>
                      )}
                      {claim.adminNote && (
                        <p className="text-xs text-text-dim mt-2">Admin note: <span className="text-text">{claim.adminNote}</span></p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}