"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#e84b3a", "#22c55e", "#60a5fa", "#f97316", "#eab308"];

type Props = {
  claimsByStatus: Array<{ status: string; count: number }>;
  triggerExposure: Array<{ type: string; count: number }>;
  payoutTrend: Array<{ day: string; payout: number }>;
};

export default function DashboardCharts({ claimsByStatus, triggerExposure, payoutTrend }: Props) {
  const tooltipStyle = {
    backgroundColor: "#111318",
    border: "1px solid #1e2330",
    borderRadius: "8px",
    color: "#d4d8e8",
    fontSize: "12px",
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Claims by status</p>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={claimsByStatus}>
            <XAxis dataKey="status" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#e84b3a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Trigger exposure mix</p>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie data={triggerExposure} dataKey="count" nameKey="type" innerRadius={52} outerRadius={82} paddingAngle={4}>
              {triggerExposure.map((entry, index) => (
                <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {triggerExposure.map((entry, index) => (
            <div key={entry.type} className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
              {entry.type}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-mono text-text-dim uppercase tracking-wider mb-4">Payout trend</p>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={payoutTrend}>
            <defs>
              <linearGradient id="payoutFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="payout" stroke="#60a5fa" strokeWidth={2} fill="url(#payoutFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
