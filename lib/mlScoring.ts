import type { RiskLevel } from "@/types/platform";

export interface IncomeClaimMlInput {
  zoneMatch: boolean;
  payoutRatio: number;
  recentClaimCount: number;
  trustScore: number;
  triggerSeverity: string;
  impactHours: number;
  weeklyIncome: number;
  approvedPayout: number;
  gpsVerified?: boolean;
  onShiftAtTime?: boolean;
}

export interface IncomeClaimMlResult {
  riskScore: number;
  riskLevel: RiskLevel;
  flags: string[];
  validationSummary: string;
}

type IncomeClaimMlResponse = {
  risk_score?: number;
  risk_level?: string;
  flags?: unknown;
  validation_summary?: string;
};

const DEFAULT_ML_SERVICE_URL = "http://localhost:8000";
const ML_SERVICE_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS ?? 2500);

function toRiskLevel(value: string | undefined): RiskLevel {
  if (value === "CRITICAL" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

function toFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function scoreIncomeClaimWithMl(input: IncomeClaimMlInput): Promise<IncomeClaimMlResult | null> {
  if (process.env.ENABLE_ML_SCORING === "false") {
    return null;
  }

  const serviceUrl = (process.env.ML_SERVICE_URL ?? DEFAULT_ML_SERVICE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${serviceUrl}/score-income-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zone_match: input.zoneMatch,
        payout_ratio: input.payoutRatio,
        recent_claim_count: input.recentClaimCount,
        trust_score: input.trustScore,
        trigger_severity: input.triggerSeverity,
        impact_hours: input.impactHours,
        weekly_income: input.weeklyIncome,
        approved_payout: input.approvedPayout,
        gps_verified: input.gpsVerified ?? true,
        on_shift_at_time: input.onShiftAtTime ?? true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as IncomeClaimMlResponse;
    if (typeof payload.risk_score !== "number") {
      return null;
    }

    return {
      riskScore: Math.round(payload.risk_score),
      riskLevel: toRiskLevel(payload.risk_level),
      flags: toFlags(payload.flags),
      validationSummary:
        typeof payload.validation_summary === "string"
          ? payload.validation_summary
          : "ML scoring completed.",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
