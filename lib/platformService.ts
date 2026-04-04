import { Policy, Prisma, TriggerEvent, WorkerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateIncomeLoss,
  calculateWeeklyQuote,
  evaluateFraudSignal,
  getMockTriggerCatalog,
} from "@/lib/protectionEngine";
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

export async function ensureMockTriggers() {
  const catalog = getMockTriggerCatalog();

  await Promise.all(
    catalog.map((trigger) =>
      prisma.triggerEvent.upsert({
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
          metadata: JSON.stringify({ mode: "mock", refreshedAt: new Date().toISOString() }),
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
          metadata: JSON.stringify({ mode: "mock", refreshedAt: new Date().toISOString() }),
        },
      }),
    ),
  );
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
  await ensureMockTriggers();

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
  await ensureMockTriggers();

  const { profile, policy } = await syncPolicyForUser(userId);
  if (!profile || !policy) {
    return { created: 0, claims: [] as ClaimView[] };
  }

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

    const fraud = evaluateFraudSignal({
      zoneMatch: trigger.zone === profile.zone,
      weeklyCoverage: policy.weeklyCoverage,
      estimatedIncomeLoss: payout.estimatedIncomeLoss,
      recentClaimCount,
      trustScore: profile.trustScore,
    });

    const status = fraud.fraudScore >= 70 ? "REVIEW_REQUIRED" : "PAID";
    const payoutReference =
      status === "PAID"
        ? `UPI-${trigger.type.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`
        : null;

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
        fraudFlags: JSON.stringify(fraud.flags),
        validationSummary: fraud.validationSummary,
        payoutReference,
        triggerSnapshot: JSON.stringify({
          title: trigger.title,
          source: trigger.source,
          impactHours: trigger.impactHours,
          payoutMultiplier: trigger.payoutMultiplier,
        }),
      },
    });

    created += 1;
  }

  const claims = await prisma.incomeClaim.findMany({
    where: { userId },
    include: { triggerEvent: true, policy: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  return { created, claims: claims.map(mapClaim) };
}

export async function simulateDisruptionForUser(userId: string) {
  await ensureMockTriggers();

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
  await ensureMockTriggers();

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
    include: { triggerEvent: true },
  });

  if (!claim) {
    throw new Error("Claim not found.");
  }

  const nextStatus =
    action === "APPROVE" ? "PAID" :
    action === "BLOCK" ? "BLOCKED" :
    "REVIEW_REQUIRED";

  const payoutReference =
    action === "APPROVE"
      ? claim.payoutReference ?? `UPI-ADM-${Date.now().toString(36).toUpperCase()}`
      : action === "BLOCK"
        ? null
        : claim.payoutReference;

  await prisma.incomeClaim.update({
    where: { id: claimId },
    data: {
      status: nextStatus,
      payoutReference,
      validationSummary:
        action === "APPROVE"
          ? "Admin approved the claim after manual review and released payout."
          : action === "BLOCK"
            ? "Admin blocked the claim after manual review because the payout did not meet validation checks."
            : "Claim moved back to the review queue for another decision.",
    },
  });

  const payload = await getAdminOperations();
  return {
    ...payload,
    message:
      action === "APPROVE"
        ? "Claim approved and payout released."
        : action === "BLOCK"
          ? "Claim blocked from payout."
          : "Claim returned to the review queue.",
  };
}
