import { Policy, Prisma, TriggerEvent, WorkerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateIncomeLoss,
  calculateWeeklyQuote,
  evaluateFraudSignal,
  getMockTriggerCatalog,
} from "@/lib/protectionEngine";
import {
  fetchLiveTriggersFromOpenMeteo,
  type ExternalTriggerCandidate,
  type TriggerLocation,
} from "@/lib/externalTriggers";
import { scoreIncomeClaimWithMl } from "@/lib/mlScoring";
import { issueClaimPayout } from "@/lib/payoutGateway";
import type {
  AdminActionResponse,
  AdminOperationsResponse,
  ClaimView,
  DashboardResponse,
  PolicyContextResponse,
  PolicyView,
  WorkerProfileInput,
  WorkerProfileView,
} from "@/types/platform";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapProfile(
  profile: WorkerProfile | null,
): WorkerProfileView | null {
  if (!profile) return null;
  return {
    id: profile.id,
    phone: profile.phone,
    city: profile.city,
    zone: profile.zone,
    platform: profile.platform,
    vehicleType: profile.vehicleType,
    weeklyIncome: profile.weeklyIncome,
    avgHoursPerDay: profile.avgHoursPerDay,
    workDaysPerWeek: profile.workDaysPerWeek,
    upiId: profile.upiId,
    trustScore: profile.trustScore,
  };
}

function mapPolicy(
  policy: Policy | null,
): PolicyView | null {
  if (!policy) return null;
  return {
    id: policy.id,
    policyNumber: policy.policyNumber,
    status: policy.status as PolicyView["status"],
    weeklyPremium: policy.weeklyPremium,
    weeklyCoverage: policy.weeklyCoverage,
    coverageHours: policy.coverageHours,
    riskScore: policy.riskScore,
    riskLevel: policy.riskLevel as PolicyView["riskLevel"],
    payoutChannel: policy.payoutChannel,
    pricingBreakdown: parseJson(policy.pricingBreakdown, []),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function mapTrigger(trigger: TriggerEvent) {
  return {
    id: trigger.id,
    externalId: trigger.externalId,
    type: trigger.type,
    severity: trigger.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    city: trigger.city,
    zone: trigger.zone,
    source: trigger.source,
    title: trigger.title,
    description: trigger.description,
    impactHours: trigger.impactHours,
    payoutMultiplier: trigger.payoutMultiplier,
    isActive: trigger.isActive,
    startsAt: trigger.startsAt.toISOString(),
    endsAt: trigger.endsAt.toISOString(),
  };
}

function mapClaim(
  claim: Prisma.IncomeClaimGetPayload<{
    include: { triggerEvent: true; policy: true; user?: true };
  }>,
): ClaimView {
  return {
    id: claim.id,
    status: claim.status as ClaimView["status"],
    estimatedIncomeLoss: claim.estimatedIncomeLoss,
    approvedPayout: claim.approvedPayout,
    fraudScore: claim.fraudScore,
    fraudLevel: claim.fraudLevel as ClaimView["fraudLevel"],
    fraudFlags: parseJson<string[]>(claim.fraudFlags, []),
    validationSummary: claim.validationSummary,
    payoutReference: claim.payoutReference,
    payoutChannel: claim.payoutChannel,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    trigger: mapTrigger(claim.triggerEvent),
    policyNumber: claim.policy.policyNumber,
    workerName: "user" in claim && claim.user ? claim.user.name : undefined,
    workerEmail: "user" in claim && claim.user ? claim.user.email : undefined,
  };
}

function buildPolicyNumber(userId: string) {
  return `POL-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

type TriggerCatalogEntry = ReturnType<typeof getMockTriggerCatalog>[number] | ExternalTriggerCandidate;

export type TriggerWebhookEventInput = {
  externalId?: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  city: string;
  zone: string;
  title: string;
  description: string;
  impactHours: number;
  payoutMultiplier: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type TriggerWebhookPayload = {
  provider: string;
  events: TriggerWebhookEventInput[];
};

const USE_REAL_TRIGGERS = process.env.USE_REAL_TRIGGERS === "true";
const ALLOW_MOCK_FALLBACK = process.env.REAL_TRIGGERS_FALLBACK_TO_MOCK !== "false";
const TRIGGER_REFRESH_WINDOW_MS = Number(process.env.TRIGGER_REFRESH_WINDOW_MS ?? 10 * 60 * 1000);

let lastCatalogRefreshAt = 0;
let catalogRefreshInFlight: Promise<void> | null = null;
let lastCatalogSource: "live" | "mock" | "webhook" | "none" = "none";
let lastCatalogCount = 0;

function clampScore(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function refreshTrustScoreForUser(userId: string) {
  const profile = await prisma.workerProfile.findUnique({
    where: { userId },
    select: { trustScore: true },
  });

  if (!profile) return;

  const claims = await prisma.incomeClaim.findMany({
    where: { userId },
    select: { status: true, fraudScore: true, createdAt: true },
  });

  if (claims.length === 0) {
    const baseline = 0.72;
    if (Math.abs((profile.trustScore ?? baseline) - baseline) > 0.005) {
      await prisma.workerProfile.update({ where: { userId }, data: { trustScore: baseline } });
    }
    return;
  }

  const now = Date.now();
  const recentWindowMs = 30 * 24 * 60 * 60 * 1000;
  const totalClaims = claims.length;
  const paidCount = claims.filter((claim) => claim.status === "PAID").length;
  const reviewCount = claims.filter((claim) => claim.status === "REVIEW_REQUIRED").length;
  const blockedCount = claims.filter((claim) => claim.status === "BLOCKED").length;
  const highFraudCount = claims.filter((claim) => claim.fraudScore >= 70).length;
  const recentClaimCount = claims.filter((claim) => now - claim.createdAt.getTime() <= recentWindowMs).length;

  const paidRatio = paidCount / totalClaims;
  const reviewRatio = reviewCount / totalClaims;
  const blockedRatio = blockedCount / totalClaims;
  const highFraudRatio = highFraudCount / totalClaims;
  const avgFraudScore = claims.reduce((sum, claim) => sum + claim.fraudScore, 0) / totalClaims;
  const avgFraudRatio = avgFraudScore / 100;
  const activityPenalty = Math.min(recentClaimCount / 12, 1) * 0.06;

  const computedTrustScore = clampScore(
    0.72 +
      paidRatio * 0.12 -
      reviewRatio * 0.08 -
      blockedRatio * 0.18 -
      highFraudRatio * 0.12 -
      avgFraudRatio * 0.2 -
      activityPenalty,
    0.45,
    0.95,
  );

  if (Math.abs(computedTrustScore - profile.trustScore) <= 0.005) {
    return;
  }

  await prisma.workerProfile.update({
    where: { userId },
    data: {
      trustScore: Math.round(computedTrustScore * 1000) / 1000,
    },
  });
}

async function upsertTriggerCatalog(catalog: TriggerCatalogEntry[], mode: "mock" | "live" | "webhook") {
  const refreshedAt = new Date().toISOString();

  await Promise.all(
    catalog.map((trigger) => {
      const metadata =
        "metadata" in trigger && trigger.metadata
          ? trigger.metadata
          : {};

      return prisma.triggerEvent.upsert({
        where: { externalId: trigger.externalId },
        update: {
          type: trigger.type,
          severity: trigger.severity,
          city: trigger.city,
          zone: trigger.zone,
          source: trigger.source,
          title: trigger.title,
          description: trigger.description,
          impactHours: trigger.impactHours,
          payoutMultiplier: trigger.payoutMultiplier,
          isActive: trigger.isActive,
          startsAt: trigger.startsAt,
          endsAt: trigger.endsAt,
          metadata: JSON.stringify({
            mode,
            refreshedAt,
            measurements: metadata,
          }),
        },
        create: {
          externalId: trigger.externalId,
          type: trigger.type,
          severity: trigger.severity,
          city: trigger.city,
          zone: trigger.zone,
          source: trigger.source,
          title: trigger.title,
          description: trigger.description,
          impactHours: trigger.impactHours,
          payoutMultiplier: trigger.payoutMultiplier,
          isActive: trigger.isActive,
          startsAt: trigger.startsAt,
          endsAt: trigger.endsAt,
          metadata: JSON.stringify({
            mode,
            refreshedAt,
            measurements: metadata,
          }),
        },
      });
    }),
  );
}

function normalizeWebhookEvent(event: TriggerWebhookEventInput, provider: string, now: Date): ExternalTriggerCandidate | null {
  if (!event.type || !event.city || !event.zone || !event.title || !event.description) {
    return null;
  }

  const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(event.severity)
    ? event.severity
    : "MEDIUM";

  const startsAt = event.startsAt ? new Date(event.startsAt) : new Date(now.getTime() - 10 * 60 * 1000);
  const endsAt = event.endsAt ? new Date(event.endsAt) : new Date(now.getTime() + 6 * 60 * 60 * 1000);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }

  const externalId =
    event.externalId && event.externalId.trim().length > 0
      ? event.externalId
      : `WH-${provider.toUpperCase()}-${event.type.toUpperCase()}-${event.city.slice(0, 3).toUpperCase()}-${event.zone.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return {
    externalId,
    type: event.type,
    severity,
    city: event.city,
    zone: event.zone,
    source: event.source ?? `Webhook ${provider}`,
    title: event.title,
    description: event.description,
    impactHours: Math.max(1, Number(event.impactHours || 0)),
    payoutMultiplier: Math.max(0.05, Number(event.payoutMultiplier || 0)),
    isActive: event.isActive ?? true,
    startsAt,
    endsAt,
    metadata: event.metadata ?? {},
  };
}

export async function ingestTriggerWebhookPayload(payload: TriggerWebhookPayload) {
  const provider = String(payload.provider || "external").trim() || "external";
  const now = new Date();

  const normalized = (payload.events ?? [])
    .map((event) => normalizeWebhookEvent(event, provider, now))
    .filter((event): event is ExternalTriggerCandidate => Boolean(event));

  if (normalized.length === 0) {
    return { accepted: 0, rejected: (payload.events ?? []).length };
  }

  await upsertTriggerCatalog(normalized, "webhook");
  lastCatalogSource = "webhook";
  lastCatalogCount = normalized.length;
  lastCatalogRefreshAt = Date.now();

  return {
    accepted: normalized.length,
    rejected: (payload.events ?? []).length - normalized.length,
  };
}

export async function ensureMockTriggers() {
  const catalog = getMockTriggerCatalog();
  await upsertTriggerCatalog(catalog, "mock");
  lastCatalogSource = "mock";
  lastCatalogCount = catalog.length;
}

async function syncLiveTriggers() {
  const now = new Date();
  const workerLocations = await prisma.workerProfile.findMany({
    select: { city: true, zone: true },
  });
  const catalog = await fetchLiveTriggersFromOpenMeteo(now, workerLocations as TriggerLocation[]);
  const activeExternalIds = catalog.map((trigger) => trigger.externalId);

  await upsertTriggerCatalog(catalog, "live");

  if (activeExternalIds.length > 0) {
    await prisma.triggerEvent.updateMany({
      where: {
        externalId: { startsWith: "REAL-" },
        isActive: true,
        NOT: { externalId: { in: activeExternalIds } },
      },
      data: {
        isActive: false,
        endsAt: now,
        metadata: JSON.stringify({ mode: "live", refreshedAt: now.toISOString(), status: "inactive" }),
      },
    });
  } else {
    await prisma.triggerEvent.updateMany({
      where: {
        externalId: { startsWith: "REAL-" },
        isActive: true,
      },
      data: {
        isActive: false,
        endsAt: now,
        metadata: JSON.stringify({ mode: "live", refreshedAt: now.toISOString(), status: "inactive" }),
      },
    });
  }

  lastCatalogSource = "live";
  lastCatalogCount = catalog.length;
  return catalog.length;
}

export async function ensureTriggerCatalog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && now - lastCatalogRefreshAt < TRIGGER_REFRESH_WINDOW_MS) {
    return;
  }

  if (catalogRefreshInFlight) {
    await catalogRefreshInFlight;
    return;
  }

  catalogRefreshInFlight = (async () => {
    if (!USE_REAL_TRIGGERS) {
      await ensureMockTriggers();
      lastCatalogRefreshAt = Date.now();
      return;
    }

    try {
      const liveCount = await syncLiveTriggers();
      if (liveCount === 0 && ALLOW_MOCK_FALLBACK) {
        await ensureMockTriggers();
      }
    } catch {
      if (ALLOW_MOCK_FALLBACK) {
        await ensureMockTriggers();
      } else {
        throw new Error("Real trigger sync failed and mock fallback is disabled.");
      }
    }

    lastCatalogRefreshAt = Date.now();
  })().finally(() => {
    catalogRefreshInFlight = null;
  });

  await catalogRefreshInFlight;
}

export async function forceRefreshTriggerCatalog(): Promise<AdminActionResponse> {
  await ensureTriggerCatalog(true);
  const payload = await getAdminOperations();

  const message =
    lastCatalogSource === "live"
      ? `Live feeds synced. ${lastCatalogCount} active live triggers loaded.`
      : lastCatalogSource === "mock"
        ? `Live feeds unavailable. Loaded ${lastCatalogCount} mock triggers for continuity.`
        : "Trigger sync completed.";

  return {
    ...payload,
    message,
  };
}

export async function createProfileAndPolicy(userId: string, input: WorkerProfileInput) {
  const profile = await prisma.workerProfile.create({
    data: {
      userId,
      phone: input.phone,
      city: input.city,
      zone: input.zone,
      platform: input.platform,
      vehicleType: input.vehicleType,
      weeklyIncome: input.weeklyIncome,
      avgHoursPerDay: input.avgHoursPerDay,
      workDaysPerWeek: input.workDaysPerWeek,
      upiId: input.upiId,
    },
  });

  const quote = calculateWeeklyQuote({
    city: input.city,
    zone: input.zone,
    platform: input.platform,
    vehicleType: input.vehicleType,
    weeklyIncome: input.weeklyIncome,
    avgHoursPerDay: input.avgHoursPerDay,
    workDaysPerWeek: input.workDaysPerWeek,
    trustScore: profile.trustScore,
  });

  const policy = await prisma.policy.create({
    data: {
      userId,
      profileId: profile.id,
      policyNumber: buildPolicyNumber(userId),
      weeklyPremium: quote.weeklyPremium,
      weeklyCoverage: quote.weeklyCoverage,
      coverageHours: quote.coverageHours,
      riskScore: quote.riskScore,
      riskLevel: quote.riskLevel,
      pricingBreakdown: JSON.stringify(quote.pricingBreakdown),
    },
  });

  return { profile, policy };
}

export async function syncPolicyForUser(userId: string) {
  const profile = await prisma.workerProfile.findUnique({ where: { userId } });
  if (!profile) return { profile: null, policy: null };

  const quote = calculateWeeklyQuote({
    city: profile.city,
    zone: profile.zone,
    platform: profile.platform,
    vehicleType: profile.vehicleType,
    weeklyIncome: profile.weeklyIncome,
    avgHoursPerDay: profile.avgHoursPerDay,
    workDaysPerWeek: profile.workDaysPerWeek,
    trustScore: profile.trustScore,
  });

  const latestPolicy = await prisma.policy.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const policy = latestPolicy
    ? await prisma.policy.update({
        where: { id: latestPolicy.id },
        data: {
          weeklyPremium: quote.weeklyPremium,
          weeklyCoverage: quote.weeklyCoverage,
          coverageHours: quote.coverageHours,
          riskScore: quote.riskScore,
          riskLevel: quote.riskLevel,
          pricingBreakdown: JSON.stringify(quote.pricingBreakdown),
        },
      })
    : await prisma.policy.create({
        data: {
          userId,
          profileId: profile.id,
          policyNumber: buildPolicyNumber(userId),
          weeklyPremium: quote.weeklyPremium,
          weeklyCoverage: quote.weeklyCoverage,
          coverageHours: quote.coverageHours,
          riskScore: quote.riskScore,
          riskLevel: quote.riskLevel,
          pricingBreakdown: JSON.stringify(quote.pricingBreakdown),
        },
      });

  return { profile, policy };
}

export async function getPolicyContextForUser(userId: string): Promise<PolicyContextResponse> {
  await ensureTriggerCatalog();

  const { profile, policy } = await syncPolicyForUser(userId);
  if (!profile || !policy) {
    return { profile: null, policy: null, activeTriggers: [], recentClaims: [] };
  }

  const now = new Date();
  const triggers = await prisma.triggerEvent.findMany({
    where: {
      isActive: true,
      city: profile.city,
      startsAt: { lte: now },
      endsAt: { gte: now },
      zone: profile.zone,
    },
    orderBy: [{ severity: "desc" }, { startsAt: "asc" }],
  });

  const claims = await prisma.incomeClaim.findMany({
    where: { userId },
    include: { triggerEvent: true, policy: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return {
    profile: mapProfile(profile),
    policy: mapPolicy(policy),
    activeTriggers: triggers.map(mapTrigger),
    recentClaims: claims.map(mapClaim),
  };
}

export async function runAutomationForUser(userId: string) {
  await ensureTriggerCatalog();

  const { profile, policy } = await syncPolicyForUser(userId);
  if (!profile || !policy) {
    return { created: 0, claims: [] as ClaimView[] };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (policy.status !== "ACTIVE") {
    const claims = await prisma.incomeClaim.findMany({
      where: { userId },
      include: { triggerEvent: true, policy: true, user: true },
      orderBy: { createdAt: "desc" },
    });

    return { created: 0, claims: claims.map(mapClaim) };
  }

  const now = new Date();
  const activeTriggers = await prisma.triggerEvent.findMany({
    where: {
      isActive: true,
      city: profile.city,
      zone: profile.zone,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: "asc" },
  });

  const recentClaimCount = await prisma.incomeClaim.count({
    where: {
      userId,
      createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  let created = 0;

  for (const trigger of activeTriggers) {
    // DUPLICATE CLAIM PREVENTION
    // Strict database-level and logic-level validation prevents a user
    // from claiming multiple times for the exact same disruption event.
    const existing = await prisma.incomeClaim.findUnique({
      where: {
        policyId_triggerEventId: {
          policyId: policy.id,
          triggerEventId: trigger.id,
        },
      },
    });

    if (existing) continue;

    const payout = calculateIncomeLoss({
      weeklyIncome: profile.weeklyIncome,
      impactHours: trigger.impactHours,
      avgHoursPerDay: profile.avgHoursPerDay,
      workDaysPerWeek: profile.workDaysPerWeek,
      payoutMultiplier: trigger.payoutMultiplier,
      weeklyCoverage: policy.weeklyCoverage,
    });

    const fallbackFraud = evaluateFraudSignal({
      zoneMatch: trigger.zone === profile.zone,
      weeklyCoverage: policy.weeklyCoverage,
      estimatedIncomeLoss: payout.estimatedIncomeLoss,
      recentClaimCount,
      trustScore: profile.trustScore,
    });

    const mlFraud = await scoreIncomeClaimWithMl({
      zoneMatch: trigger.zone === profile.zone,
      payoutRatio: payout.approvedPayout / Math.max(policy.weeklyCoverage, 1),
      recentClaimCount,
      trustScore: profile.trustScore,
      triggerSeverity: trigger.severity,
      impactHours: trigger.impactHours,
      weeklyIncome: profile.weeklyIncome,
      approvedPayout: payout.approvedPayout,
      // LOCATION AND ACTIVITY VALIDATION (Simulated for this demo API representation, normally from external webhooks)
      gpsVerified: Math.random() > 0.15,     // Simulate 85% passed GPS check 
      onShiftAtTime: Math.random() > 0.20,   // Simulate 80% activity validation checked from Platform API
    });

    const fraud = mlFraud
      ? {
          fraudScore: mlFraud.riskScore,
          fraudLevel: mlFraud.riskLevel,
          flags: mlFraud.flags.length > 0 ? mlFraud.flags : fallbackFraud.flags,
          validationSummary: `${mlFraud.validationSummary} (Scoring source: ML service)`,
        }
      : {
          ...fallbackFraud,
          validationSummary: `${fallbackFraud.validationSummary} (Scoring source: rule engine fallback)`,
        };

    let status = fraud.fraudScore >= 70 ? "REVIEW_REQUIRED" : "PAID";
    let payoutReference: string | null = null;
    const fraudFlags = [...fraud.flags];
    let validationSummary = fraud.validationSummary;

    if (status === "PAID") {
      const payoutResult = await issueClaimPayout({
        claimId: `AUTO-${policy.id.slice(-6)}-${trigger.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
        amountInr: payout.approvedPayout,
        upiId: profile.upiId,
        workerName: user?.name ?? "Worker",
        workerPhone: profile.phone,
      });

      if (payoutResult.success && payoutResult.reference) {
        payoutReference = payoutResult.reference;
        if (payoutResult.provider === "mock-fallback" && payoutResult.error) {
          fraudFlags.push(`Payout provider failed, switched to fallback: ${payoutResult.error}`);
          validationSummary = `${validationSummary} Payout fallback used due to gateway issue.`;
        }
      } else {
        status = "REVIEW_REQUIRED";
        payoutReference = null;
        fraudFlags.push(`Payout dispatch failed: ${payoutResult.error ?? "Unknown provider error"}`);
        validationSummary = `${validationSummary} Auto payout failed and the claim was routed for manual review.`;
      }
    }

    await prisma.incomeClaim.create({
      data: {
        userId,
        policyId: policy.id,
        triggerEventId: trigger.id,
        status,
        estimatedIncomeLoss: payout.estimatedIncomeLoss,
        approvedPayout: payout.approvedPayout,
        fraudScore: fraud.fraudScore,
        fraudLevel: fraud.fraudLevel,
        fraudFlags: JSON.stringify(fraudFlags),
        validationSummary,
        payoutReference,
        triggerSnapshot: JSON.stringify({
          title: trigger.title,
          source: trigger.source,
          impactHours: trigger.impactHours,
          payoutMultiplier: trigger.payoutMultiplier,
          scoringSource: mlFraud ? "ML_SERVICE" : "RULE_ENGINE",
        }),
      },
    });

    created += 1;
  }

  if (created > 0) {
    await refreshTrustScoreForUser(userId);
  }

  const claims = await prisma.incomeClaim.findMany({
    where: { userId },
    include: { triggerEvent: true, policy: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  return { created, claims: claims.map(mapClaim) };
}

export async function simulateDisruptionForUser(userId: string) {
  await ensureTriggerCatalog();

  const { profile, policy } = await syncPolicyForUser(userId);
  if (!profile || !policy) {
    return { created: 0, claims: [] as ClaimView[], simulatedTriggerTitle: null as string | null };
  }

  const now = new Date();
  const externalId = `DEMO-${profile.city.slice(0, 3).toUpperCase()}-${profile.zone.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  await prisma.triggerEvent.create({
    data: {
      externalId,
      type: "DEMO_DISRUPTION",
      severity: "HIGH",
      city: profile.city,
      zone: profile.zone,
      source: "Demo simulator",
      title: `Simulated disruption for ${profile.zone}`,
      description: "A demo-only trigger created to showcase zero-touch income-loss claim automation on demand.",
      impactHours: 5,
      payoutMultiplier: 0.29,
      isActive: true,
      startsAt: new Date(now.getTime() - 5 * 60 * 1000),
      endsAt: new Date(now.getTime() + 55 * 60 * 1000),
      metadata: JSON.stringify({ mode: "demo-simulated", createdAt: now.toISOString() }),
    },
  });

  const result = await runAutomationForUser(userId);
  return {
    ...result,
    simulatedTriggerTitle: `Simulated disruption for ${profile.zone}`,
  };
}

export async function getClaimsForUser(userId: string) {
  const claims = await prisma.incomeClaim.findMany({
    where: { userId },
    include: { triggerEvent: true, policy: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  return claims.map(mapClaim);
}

export async function getDashboardForUser(userId: string): Promise<DashboardResponse> {
  const context = await getPolicyContextForUser(userId);
  const claims = await getClaimsForUser(userId);

  const paidThisWeek = claims
    .filter((claim) => claim.status === "PAID")
    .reduce((sum, claim) => sum + claim.approvedPayout, 0);

  const claimsByStatus = ["PAID", "REVIEW_REQUIRED", "AUTO_INITIATED", "BLOCKED"].map((status) => ({
    status,
    count: claims.filter((claim) => claim.status === status).length,
  })).filter((entry) => entry.count > 0);

  const triggerMap = new Map<string, number>();
  claims.forEach((claim) => {
    triggerMap.set(claim.trigger.type, (triggerMap.get(claim.trigger.type) ?? 0) + 1);
  });

  const payoutTrendMap = new Map<string, number>();
  claims.forEach((claim) => {
    const day = new Date(claim.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    payoutTrendMap.set(day, (payoutTrendMap.get(day) ?? 0) + claim.approvedPayout);
  });

  return {
    metrics: [
      {
        label: "Weekly premium",
        value: context.policy ? `₹${context.policy.weeklyPremium}` : "N/A",
        accent: "text-accent",
      },
      {
        label: "Protected income",
        value: context.policy ? `₹${context.policy.weeklyCoverage}` : "N/A",
        accent: "text-green-300",
      },
      {
        label: "Active triggers",
        value: `${context.activeTriggers.length}`,
        accent: "text-orange-300",
      },
      {
        label: "Auto-paid payouts",
        value: `₹${paidThisWeek}`,
        accent: "text-blue-300",
      },
    ],
    profile: context.profile,
    policy: context.policy,
    activeTriggers: context.activeTriggers,
    recentClaims: claims.slice(0, 5),
    claimsByStatus,
    triggerExposure: Array.from(triggerMap.entries()).map(([type, count]) => ({ type, count })),
    payoutTrend: Array.from(payoutTrendMap.entries()).map(([day, payout]) => ({ day, payout })),
  };
}

export async function getAdminOperations(): Promise<AdminOperationsResponse> {
  await ensureTriggerCatalog();

  const [policies, claims, activeTriggers] = await Promise.all([
    prisma.policy.findMany({
      include: {
        user: { select: { name: true, email: true } },
        profile: { select: { city: true, zone: true, platform: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.incomeClaim.findMany({
      include: { triggerEvent: true, policy: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.triggerEvent.findMany({
      orderBy: [{ severity: "desc" }, { city: "asc" }],
    }),
  ]);

  const payouts = claims
    .filter((claim) => claim.status === "PAID")
    .reduce((sum, claim) => sum + claim.approvedPayout, 0);

  return {
    metrics: [
      { label: "Active policies", value: `${policies.filter((policy) => policy.status === "ACTIVE").length}`, accent: "text-text" },
      { label: "Live triggers", value: `${activeTriggers.filter((trigger) => trigger.isActive).length}`, accent: "text-orange-300" },
      { label: "Zero-touch payouts", value: `${claims.filter((claim) => claim.status === "PAID").length}`, accent: "text-green-300" },
      { label: "Review queue", value: `${claims.filter((claim) => claim.status === "REVIEW_REQUIRED").length}`, accent: "text-accent" },
    ],
    activeTriggers: activeTriggers.map(mapTrigger),
    policies: policies.map((policy) => ({
      ...(mapPolicy(policy) as PolicyView),
      workerName: policy.user.name,
      workerEmail: policy.user.email,
      city: policy.profile.city,
      zone: policy.profile.zone,
      platform: policy.profile.platform,
    })),
    claims: claims.map(mapClaim),
  };
}

export async function updateTriggerStatus(triggerId: string, isActive: boolean): Promise<AdminActionResponse> {
  await prisma.triggerEvent.update({
    where: { id: triggerId },
    data: { isActive },
  });

  const payload = await getAdminOperations();
  return {
    ...payload,
    message: isActive ? "Trigger activated for automated monitoring." : "Trigger deactivated and removed from live monitoring.",
  };
}

export async function updatePolicyStatus(policyId: string, status: "ACTIVE" | "PAUSED"): Promise<AdminActionResponse> {
  await prisma.policy.update({
    where: { id: policyId },
    data: { status },
  });

  const payload = await getAdminOperations();
  return {
    ...payload,
    message: status === "ACTIVE" ? "Policy resumed and can receive automated trigger payouts again." : "Policy paused. No new zero-touch claims will be opened for it.",
  };
}

export async function reviewClaimAction(
  claimId: string,
  action: "APPROVE" | "BLOCK" | "REOPEN",
): Promise<AdminActionResponse> {
  const claim = await prisma.incomeClaim.findUnique({
    where: { id: claimId },
    include: {
      triggerEvent: true,
      user: { select: { name: true } },
      policy: { include: { profile: true } },
    },
  });

  if (!claim) {
    throw new Error("Claim not found.");
  }

  let nextStatus =
    action === "APPROVE" ? "PAID" :
    action === "BLOCK" ? "BLOCKED" :
    "REVIEW_REQUIRED";

  let payoutReference =
    action === "BLOCK"
      ? null
      : claim.payoutReference;

  let validationSummary =
    action === "APPROVE"
      ? "Admin approved the claim after manual review and released payout."
      : action === "BLOCK"
        ? "Admin blocked the claim after manual review because the payout did not meet validation checks."
        : "Claim moved back to the review queue for another decision.";

  if (action === "APPROVE" && !claim.payoutReference) {
    const payoutResult = await issueClaimPayout({
      claimId: claim.id,
      amountInr: claim.approvedPayout,
      upiId: claim.policy.profile.upiId,
      workerName: claim.user.name,
      workerPhone: claim.policy.profile.phone,
    });

    if (payoutResult.success && payoutResult.reference) {
      payoutReference = payoutResult.reference;
      validationSummary = "Admin approved the claim and payout was sent through the configured payout provider.";
      if (payoutResult.provider === "mock-fallback" && payoutResult.error) {
        validationSummary = `Admin approved the claim with payout fallback because provider call failed: ${payoutResult.error}`;
      }
    } else {
      nextStatus = "REVIEW_REQUIRED";
      payoutReference = null;
      validationSummary = `Admin approval attempted but payout dispatch failed: ${payoutResult.error ?? "Unknown provider error"}`;
    }
  }

  await prisma.incomeClaim.update({
    where: { id: claimId },
    data: {
      status: nextStatus,
      payoutReference,
      validationSummary,
    },
  });

  await refreshTrustScoreForUser(claim.userId);

  const payload = await getAdminOperations();
  return {
    ...payload,
    message:
      action === "APPROVE" && nextStatus === "PAID"
        ? "Claim approved and payout released."
        : action === "APPROVE"
          ? "Claim approval recorded but payout dispatch failed and the claim remains in review."
        : action === "BLOCK"
          ? "Claim blocked from payout."
          : "Claim returned to the review queue.",
  };
}
