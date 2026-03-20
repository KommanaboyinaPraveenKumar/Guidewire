import DashboardCharts from "@/components/DashboardCharts";
import { getAllClaims } from "@/lib/claimsStore";

export default function DashboardPage() {
  const claims = getAllClaims();
  const total = claims.length;
  const critical = claims.filter((c) => c.risk_level === "CRITICAL").length;
  const high = claims.filter((c) => c.risk_level === "HIGH").length;
  const avgScore = Math.round(claims.reduce((s, c) => s + c.risk_score, 0) / (total || 1));

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">
          Analytics
        </p>
        <h1 className="text-3xl font-bold text-text">Fraud Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Claims", value: total, color: "text-text" },
          { label: "Critical Risk", value: critical, color: "text-red-400" },
          { label: "High Risk", value: high, color: "text-orange-400" },
          { label: "Avg Risk Score", value: `${avgScore}`, color: "text-accent" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-xl p-5">
            <p className="text-text-dim text-xs font-mono uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts claims={claims} />
    </div>
  );
}