"use client";
import type { ClaimResult } from "@/types/claim";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter,
} from "recharts";

const COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export default function DashboardCharts({ claims }: { claims: ClaimResult[] }) {
  const riskDist = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => ({
    name: level,
    value: claims.filter((c) => c.risk_level === level).length,
    color: COLORS[level],
  })).filter((d) => d.value > 0);

  const scoreDistribution = [
    { range: "0–20", count: 0 }, { range: "21–40", count: 0 },
    { range: "41–60", count: 0 }, { range: "61–80", count: 0 },
    { range: "81–100", count: 0 },
  ];
  claims.forEach((c) => {
    const idx = Math.min(Math.floor(c.risk_score / 20), 4);
    scoreDistribution[idx].count++;
  });

  const scatterData = claims.map((c) => ({
    x: Math.min(c.total_claim_amount / 1000, 100), // Normalize to 0-100 scale
    y: c.risk_score,
    name: `Claim: $${c.total_claim_amount}`,
  }));

  const tooltipStyle = {
    backgroundColor: "#111318", border: "1px solid #1e2330",
    borderRadius: "8px", color: "#d4d8e8", fontSize: "12px",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Risk Distribution</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={riskDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
              dataKey="value" paddingAngle={3}>
              {riskDist.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {riskDist.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Score Distribution</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={scoreDistribution} barSize={28}>
            <XAxis dataKey="range" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#e84b3a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Claim Amount vs Risk Score</p>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <XAxis dataKey="x" name="Claim ($K)" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="y" name="Risk" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={scatterData} fill="#e84b3a" opacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}