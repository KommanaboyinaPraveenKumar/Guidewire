export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyStatus = "ACTIVE" | "PAUSED" | "EXPIRED";
export type ClaimStatus = "AUTO_INITIATED" | "PAID" | "REVIEW_REQUIRED" | "BLOCKED";

export interface WorkerProfileInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  zone: string;
  platform: string;
  vehicleType: string;
  weeklyIncome: number;
  avgHoursPerDay: number;
  workDaysPerWeek: number;
  upiId: string;
}

export interface WorkerProfileView {
  id: string;
  phone: string;
  city: string;
  zone: string;
  platform: string;
  vehicleType: string;
  weeklyIncome: number;
  avgHoursPerDay: number;
  workDaysPerWeek: number;
  upiId: string;
  trustScore: number;
}

export interface PricingBreakdownItem {
  label: string;
  amount: number;
  direction: "ADD" | "SUBTRACT";
  note: string;
}

export interface PolicyView {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  weeklyPremium: number;
  weeklyCoverage: number;
  coverageHours: number;
  riskScore: number;
  riskLevel: RiskLevel;
  payoutChannel: string;
  pricingBreakdown: PricingBreakdownItem[];
  createdAt: string;
  updatedAt: string;
  workerName?: string;
  workerEmail?: string;
  city?: string;
  zone?: string;
  platform?: string;
}

export interface TriggerView {
  id: string;
  externalId: string;
  type: string;
  severity: RiskLevel;
  city: string;
  zone: string;
  source: string;
  title: string;
  description: string;
  impactHours: number;
  payoutMultiplier: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

export interface ClaimView {
  id: string;
  status: ClaimStatus;
  estimatedIncomeLoss: number;
  approvedPayout: number;
  fraudScore: number;
  fraudLevel: RiskLevel;
  fraudFlags: string[];
  validationSummary: string;
  payoutReference: string | null;
  payoutChannel: string;
  createdAt: string;
  updatedAt: string;
  trigger: TriggerView;
  policyNumber: string;
  workerName?: string;
  workerEmail?: string;
}

export interface PolicyContextResponse {
  profile: WorkerProfileView | null;
  policy: PolicyView | null;
  activeTriggers: TriggerView[];
  recentClaims: ClaimView[];
}

export interface DashboardMetric {
  label: string;
  value: string;
  accent: string;
}

export interface DashboardResponse {
  metrics: DashboardMetric[];
  profile: WorkerProfileView | null;
  policy: PolicyView | null;
  activeTriggers: TriggerView[];
  recentClaims: ClaimView[];
  claimsByStatus: Array<{ status: string; count: number }>;
  triggerExposure: Array<{ type: string; count: number }>;
  payoutTrend: Array<{ day: string; payout: number }>;
}

export interface AdminOperationsResponse {
  metrics: DashboardMetric[];
  activeTriggers: TriggerView[];
  policies: PolicyView[];
  claims: ClaimView[];
}

export interface AdminActionResponse extends AdminOperationsResponse {
  message: string;
}
