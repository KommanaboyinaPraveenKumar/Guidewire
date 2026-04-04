import type {
  PricingBreakdownItem,
  RiskLevel,
  WorkerProfileInput,
} from "@/types/platform";

type ProfileForQuote = Pick<
  WorkerProfileInput,
  "city" | "zone" | "platform" | "vehicleType" | "weeklyIncome" | "avgHoursPerDay" | "workDaysPerWeek"
> & {
  trustScore?: number;
};

type ZoneRiskProfile = {
  weatherRisk: number;
  floodRisk: number;
  pollutionRisk: number;
  socialDisruptionRisk: number;
  safeDiscount: number;
};

const DEFAULT_ZONE: ZoneRiskProfile = {
  weatherRisk: 0.46,
  floodRisk: 0.38,
  pollutionRisk: 0.24,
  socialDisruptionRisk: 0.18,
  safeDiscount: 2,
};

const ZONE_RISK_MAP: Record<string, ZoneRiskProfile> = {
  "bengaluru:indiranagar": { weatherRisk: 0.54, floodRisk: 0.42, pollutionRisk: 0.16, socialDisruptionRisk: 0.14, safeDiscount: 2 },
  "bengaluru:whitefield": { weatherRisk: 0.48, floodRisk: 0.51, pollutionRisk: 0.18, socialDisruptionRisk: 0.12, safeDiscount: 1 },
  "bengaluru:koramangala": { weatherRisk: 0.45, floodRisk: 0.32, pollutionRisk: 0.14, socialDisruptionRisk: 0.15, safeDiscount: 3 },
  "delhi:dwarka": { weatherRisk: 0.35, floodRisk: 0.17, pollutionRisk: 0.62, socialDisruptionRisk: 0.19, safeDiscount: 1 },
  "delhi:saket": { weatherRisk: 0.33, floodRisk: 0.14, pollutionRisk: 0.58, socialDisruptionRisk: 0.16, safeDiscount: 2 },
  "hyderabad:madhapur": { weatherRisk: 0.43, floodRisk: 0.19, pollutionRisk: 0.22, socialDisruptionRisk: 0.13, safeDiscount: 3 },
  "hyderabad:gachibowli": { weatherRisk: 0.39, floodRisk: 0.21, pollutionRisk: 0.2, socialDisruptionRisk: 0.12, safeDiscount: 3 },
  "mumbai:andheri": { weatherRisk: 0.57, floodRisk: 0.56, pollutionRisk: 0.19, socialDisruptionRisk: 0.18, safeDiscount: 0 },
  "mumbai:bkc": { weatherRisk: 0.52, floodRisk: 0.41, pollutionRisk: 0.18, socialDisruptionRisk: 0.17, safeDiscount: 1 },
  "pune:hinjewadi": { weatherRisk: 0.37, floodRisk: 0.15, pollutionRisk: 0.17, socialDisruptionRisk: 0.26, safeDiscount: 2 },
};

const PLATFORM_FACTORS: Record<string, number> = {
  swiggy: 1.02,
  zomato: 1.03,
  zepto: 1.08,
  amazon: 0.98,
  dunzo: 1.01,
};

const VEHICLE_FACTORS: Record<string, number> = {
  bike: 1.08,
  scooter: 1.02,
  cycle: 0.94,
  ev: 0.97,
};

export function toKey(city: string, zone: string) {
  return `${city.trim().toLowerCase()}:${zone.trim().toLowerCase()}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 58) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function calculateWeeklyQuote(profile: ProfileForQuote) {
  const zoneRisk = ZONE_RISK_MAP[toKey(profile.city, profile.zone)] ?? DEFAULT_ZONE;
  const platformFactor = PLATFORM_FACTORS[profile.platform.toLowerCase()] ?? 1;
  const vehicleFactor = VEHICLE_FACTORS[profile.vehicleType.toLowerCase()] ?? 1;
  const workExposure = clamp(
    profile.avgHoursPerDay / 12 * 0.55 + profile.workDaysPerWeek / 7 * 0.45,
    0.2,
    1,
  );
  const trustScore = clamp(profile.trustScore ?? 0.72, 0.45, 0.95);

  const riskScoreRaw =
    zoneRisk.weatherRisk * 36 +
    zoneRisk.floodRisk * 24 +
    zoneRisk.pollutionRisk * 18 +
    zoneRisk.socialDisruptionRisk * 12 +
    workExposure * 10 +
    (platformFactor - 0.95) * 50 +
    (vehicleFactor - 0.94) * 28 -
    (trustScore - 0.5) * 10;

  const riskScore = Math.round(clamp(riskScoreRaw, 18, 92));
  const riskLevel = getRiskLevel(riskScore);

  const basePremium = Math.round(profile.weeklyIncome * 0.035);
  const weatherLoad = Math.round(zoneRisk.weatherRisk * 16);
  const floodLoad = Math.round(zoneRisk.floodRisk * 13);
  const pollutionLoad = Math.round(zoneRisk.pollutionRisk * 11);
  const socialLoad = Math.round(zoneRisk.socialDisruptionRisk * 8);
  const exposureLoad = Math.round(workExposure * 10);
  const platformLoad = Math.round((platformFactor - 1) * 20);
  const vehicleLoad = Math.round((vehicleFactor - 1) * 18);
  const safeZoneDiscount = zoneRisk.safeDiscount;
  const trustDiscount = Math.round((trustScore - 0.5) * 10);

  const weeklyPremium = Math.max(
    39,
    basePremium +
      weatherLoad +
      floodLoad +
      pollutionLoad +
      socialLoad +
      exposureLoad +
      platformLoad +
      vehicleLoad -
      safeZoneDiscount -
      trustDiscount,
  );

  const weeklyCoverage = Math.round(
    Math.min(
      profile.weeklyIncome * 0.88,
      profile.weeklyIncome * (0.58 + zoneRisk.weatherRisk * 0.18 + zoneRisk.socialDisruptionRisk * 0.11),
    ),
  );

  const coverageHours = Math.round(
    clamp(
      profile.avgHoursPerDay * profile.workDaysPerWeek * (0.5 + zoneRisk.weatherRisk * 0.22),
      18,
      72,
    ),
  );

  const pricingBreakdown: PricingBreakdownItem[] = [
    { label: "Base weekly premium", amount: basePremium, direction: "ADD", note: "Aligned to the worker's average weekly income cycle." },
    { label: "Weather volatility load", amount: weatherLoad, direction: "ADD", note: "Predictive weather sensitivity for this delivery zone." },
    { label: "Waterlogging and flood load", amount: floodLoad, direction: "ADD", note: "Higher where historical flooding disrupts rider hours." },
    { label: "Air quality load", amount: pollutionLoad, direction: "ADD", note: "Used when pollution materially affects outdoor working time." },
    { label: "Social disruption load", amount: socialLoad, direction: "ADD", note: "Captures curfews, zone closures, and local access issues." },
    { label: "Exposure load", amount: exposureLoad + platformLoad + vehicleLoad, direction: "ADD", note: "Based on delivery hours, platform intensity, and vehicle type." },
    { label: "Safe-zone discount", amount: safeZoneDiscount + trustDiscount, direction: "SUBTRACT", note: "Discount for relatively safer zones and positive trust history." },
  ];

  return {
    riskScore,
    riskLevel,
    weeklyPremium,
    weeklyCoverage,
    coverageHours,
    pricingBreakdown,
  };
}

export function getMockTriggerCatalog(now = new Date()) {
  const hour = 60 * 60 * 1000;
  return [
    {
      externalId: "BLR-RAIN-IND-01",
      type: "HEAVY_RAIN",
      severity: "HIGH" as RiskLevel,
      city: "Bengaluru",
      zone: "Indiranagar",
      source: "Mock IMD rainfall feed",
      title: "Heavy rain warning impacting delivery slots",
      description: "Rainfall intensity is expected to reduce rider availability and restaurant pickup throughput for the next 8 hours.",
      impactHours: 8,
      payoutMultiplier: 0.34,
      isActive: true,
      startsAt: new Date(now.getTime() - hour),
      endsAt: new Date(now.getTime() + 7 * hour),
    },
    {
      externalId: "BLR-FLOOD-WFD-01",
      type: "WATERLOGGING",
      severity: "CRITICAL" as RiskLevel,
      city: "Bengaluru",
      zone: "Whitefield",
      source: "Mock civic flood alert",
      title: "Severe waterlogging near pickup corridors",
      description: "Key roads are partially inaccessible, causing repeated order cancellations and rider downtime.",
      impactHours: 12,
      payoutMultiplier: 0.42,
      isActive: true,
      startsAt: new Date(now.getTime() - 2 * hour),
      endsAt: new Date(now.getTime() + 10 * hour),
    },
    {
      externalId: "DEL-AQI-DWK-01",
      type: "SEVERE_POLLUTION",
      severity: "HIGH" as RiskLevel,
      city: "Delhi",
      zone: "Dwarka",
      source: "Mock AQI monitoring feed",
      title: "Severe AQI event for outdoor delivery workers",
      description: "AQI threshold crossed the configured safe operating threshold for sustained outdoor work.",
      impactHours: 10,
      payoutMultiplier: 0.31,
      isActive: true,
      startsAt: new Date(now.getTime() - 3 * hour),
      endsAt: new Date(now.getTime() + 8 * hour),
    },
    {
      externalId: "HYD-HEAT-MDP-01",
      type: "EXTREME_HEAT",
      severity: "HIGH" as RiskLevel,
      city: "Hyderabad",
      zone: "Madhapur",
      source: "Mock heat stress forecast",
      title: "Extreme heat window reducing rider operating hours",
      description: "Heat stress index suggests reduced safe delivery hours across the lunch and evening peaks.",
      impactHours: 6,
      payoutMultiplier: 0.28,
      isActive: true,
      startsAt: new Date(now.getTime() - hour),
      endsAt: new Date(now.getTime() + 5 * hour),
    },
    {
      externalId: "PUN-CLOSURE-HJW-01",
      type: "ZONE_CLOSURE",
      severity: "MEDIUM" as RiskLevel,
      city: "Pune",
      zone: "Hinjewadi",
      source: "Mock local operations feed",
      title: "Unexpected market access restriction",
      description: "Temporary local closure is preventing riders from accessing normal pickup routes.",
      impactHours: 5,
      payoutMultiplier: 0.22,
      isActive: true,
      startsAt: new Date(now.getTime() - hour),
      endsAt: new Date(now.getTime() + 4 * hour),
    },
  ];
}

export function evaluateFraudSignal(input: {
  zoneMatch: boolean;
  weeklyCoverage: number;
  estimatedIncomeLoss: number;
  recentClaimCount: number;
  trustScore: number;
}) {
  const payoutRatio = clamp(input.estimatedIncomeLoss / Math.max(input.weeklyCoverage, 1), 0, 1.4);

  let score =
    (input.zoneMatch ? 0.12 : 0.48) +
    payoutRatio * 0.28 +
    Math.min(input.recentClaimCount, 4) * 0.08 +
    (1 - input.trustScore) * 0.22;

  score = clamp(score, 0.08, 0.94);
  const fraudScore = Math.round(score * 100);
  const fraudLevel = getRiskLevel(fraudScore);
  const flags: string[] = [];

  if (!input.zoneMatch) flags.push("Trigger zone does not match the worker's operating zone.");
  if (payoutRatio > 0.92) flags.push("Payout is close to the full weekly coverage limit.");
  if (input.recentClaimCount >= 2) flags.push("Multiple disruption claims already submitted this week.");
  if (input.trustScore < 0.62) flags.push("New or low-trust worker profile requires extra validation.");
  if (flags.length === 0) flags.push("Location, trigger, and payout pattern look consistent.");

  const validationSummary =
    fraudScore >= 70
      ? "Claim held for manual validation because the payout pattern is outside the usual zone and trust thresholds."
      : "Claim passed automated anomaly checks and is eligible for instant payout.";

  return { fraudScore, fraudLevel, flags, validationSummary };
}

export function calculateIncomeLoss(input: {
  weeklyIncome: number;
  impactHours: number;
  avgHoursPerDay: number;
  workDaysPerWeek: number;
  payoutMultiplier: number;
  weeklyCoverage: number;
}) {
  const scheduledHours = Math.max(1, input.avgHoursPerDay * input.workDaysPerWeek);
  const disruptionRatio = clamp(input.impactHours / scheduledHours, 0.12, 0.8);
  const estimatedIncomeLoss = Math.round(input.weeklyIncome * disruptionRatio * (0.9 + input.payoutMultiplier));
  const approvedPayout = Math.round(Math.min(estimatedIncomeLoss, input.weeklyCoverage));
  return { estimatedIncomeLoss, approvedPayout };
}
