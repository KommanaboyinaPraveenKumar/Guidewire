import type { RiskLevel } from "@/types/claim";

const config: Record<RiskLevel, { label: string; classes: string }> = {
  LOW:      { label: "LOW",      classes: "bg-green-950 text-green-400 border-green-800" },
  MEDIUM:   { label: "MEDIUM",   classes: "bg-yellow-950 text-yellow-400 border-yellow-800" },
  HIGH:     { label: "HIGH",     classes: "bg-orange-950 text-orange-400 border-orange-800" },
  CRITICAL: { label: "CRITICAL", classes: "bg-red-950 text-red-400 border-red-800" },
};

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, classes } = config[level];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${classes}`}>
      {label}
    </span>
  );
}