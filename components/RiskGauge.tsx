"use client";

type Props = { score: number };

export default function RiskGauge({ score }: Props) {
  const color =
    score >= 80 ? "#ef4444" :
    score >= 60 ? "#f97316" :
    score >= 35 ? "#eab308" : "#22c55e";

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1e2330" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-text-dim">/ 100</span>
        </div>
      </div>
      <p className="text-xs text-text-dim font-mono mt-2 uppercase tracking-wider">Risk Score</p>
    </div>
  );
}