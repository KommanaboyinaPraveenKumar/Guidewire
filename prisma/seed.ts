import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import {
  calculateIncomeLoss,
  calculateWeeklyQuote,
  evaluateFraudSignal,
  getMockTriggerCatalog,
} from "../lib/protectionEngine";

const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter } as any);

function buildPolicyNumber(userId: string) {
  return `POL-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

async function ensureWorker(user: {
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
}) {
  const hashed = await bcrypt.hash(user.password, 10);
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, password: hashed, role: "USER" },
    create: { name: user.name, email: user.email, password: hashed, role: "USER" },
  });

  const profile = await prisma.workerProfile.upsert({
    where: { userId: dbUser.id },
    update: {
      phone: user.phone,
      city: user.city,
      zone: user.zone,
      platform: user.platform,
      vehicleType: user.vehicleType,
      weeklyIncome: user.weeklyIncome,
      avgHoursPerDay: user.avgHoursPerDay,
      workDaysPerWeek: user.workDaysPerWeek,
      upiId: user.upiId,
    },
    create: {
      userId: dbUser.id,
      phone: user.phone,
      city: user.city,
      zone: user.zone,
      platform: user.platform,
      vehicleType: user.vehicleType,
      weeklyIncome: user.weeklyIncome,
      avgHoursPerDay: user.avgHoursPerDay,
      workDaysPerWeek: user.workDaysPerWeek,
      upiId: user.upiId,
    },
  });

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

  const policy = await prisma.policy.findFirst({
    where: { userId: dbUser.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const activePolicy = policy
    ? await prisma.policy.update({
        where: { id: policy.id },
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
          userId: dbUser.id,
          profileId: profile.id,
          policyNumber: buildPolicyNumber(dbUser.id),
          weeklyPremium: quote.weeklyPremium,
          weeklyCoverage: quote.weeklyCoverage,
          coverageHours: quote.coverageHours,
          riskScore: quote.riskScore,
          riskLevel: quote.riskLevel,
          pricingBreakdown: JSON.stringify(quote.pricingBreakdown),
        },
      });

  return { dbUser, profile, activePolicy };
}

async function seedTriggers() {
  for (const trigger of getMockTriggerCatalog()) {
    await prisma.triggerEvent.upsert({
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
        metadata: JSON.stringify({ mode: "mock" }),
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
        metadata: JSON.stringify({ mode: "mock" }),
      },
    });
  }
}

async function seedClaims(params: {
  userId: string;
  policyId: string;
  weeklyIncome: number;
  avgHoursPerDay: number;
  workDaysPerWeek: number;
  weeklyCoverage: number;
  trustScore: number;
  externalId: string;
}) {
  const trigger = await prisma.triggerEvent.findUnique({ where: { externalId: params.externalId } });
  if (!trigger) return;

  const payout = calculateIncomeLoss({
    weeklyIncome: params.weeklyIncome,
    impactHours: trigger.impactHours,
    avgHoursPerDay: params.avgHoursPerDay,
    workDaysPerWeek: params.workDaysPerWeek,
    payoutMultiplier: trigger.payoutMultiplier,
    weeklyCoverage: params.weeklyCoverage,
  });

  const fraud = evaluateFraudSignal({
    zoneMatch: true,
    weeklyCoverage: params.weeklyCoverage,
    estimatedIncomeLoss: payout.estimatedIncomeLoss,
    recentClaimCount: 0,
    trustScore: params.trustScore,
  });

  const status = fraud.fraudScore >= 70 ? "REVIEW_REQUIRED" : "PAID";

  await prisma.incomeClaim.upsert({
    where: {
      policyId_triggerEventId: {
        policyId: params.policyId,
        triggerEventId: trigger.id,
      },
    },
    update: {
      status,
      estimatedIncomeLoss: payout.estimatedIncomeLoss,
      approvedPayout: payout.approvedPayout,
      fraudScore: fraud.fraudScore,
      fraudLevel: fraud.fraudLevel,
      fraudFlags: JSON.stringify(fraud.flags),
      validationSummary: fraud.validationSummary,
      payoutReference: status === "PAID" ? `UPI-${trigger.type.slice(0, 3)}-SEED` : null,
      triggerSnapshot: JSON.stringify({ title: trigger.title, source: trigger.source }),
    },
    create: {
      userId: params.userId,
      policyId: params.policyId,
      triggerEventId: trigger.id,
      status,
      estimatedIncomeLoss: payout.estimatedIncomeLoss,
      approvedPayout: payout.approvedPayout,
      fraudScore: fraud.fraudScore,
      fraudLevel: fraud.fraudLevel,
      fraudFlags: JSON.stringify(fraud.flags),
      validationSummary: fraud.validationSummary,
      payoutReference: status === "PAID" ? `UPI-${trigger.type.slice(0, 3)}-SEED` : null,
      triggerSnapshot: JSON.stringify({ title: trigger.title, source: trigger.source }),
    },
  });
}

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@sentinel.ai" },
    update: { password: adminPassword, role: "ADMIN", name: "Admin" },
    create: { name: "Admin", email: "admin@sentinel.ai", password: adminPassword, role: "ADMIN" },
  });

  await seedTriggers();

  const primaryWorker = await ensureWorker({
    name: "Test User",
    email: "user@sentinel.ai",
    password: "user123",
    phone: "+91 9876543210",
    city: "Bengaluru",
    zone: "Indiranagar",
    platform: "Swiggy",
    vehicleType: "Bike",
    weeklyIncome: 5600,
    avgHoursPerDay: 8,
    workDaysPerWeek: 6,
    upiId: "user@upi",
  });

  const secondWorker = await ensureWorker({
    name: "Zone Ops Demo",
    email: "ops.worker@sentinel.ai",
    password: "ops12345",
    phone: "+91 9988776655",
    city: "Delhi",
    zone: "Dwarka",
    platform: "Zepto",
    vehicleType: "Scooter",
    weeklyIncome: 6100,
    avgHoursPerDay: 9,
    workDaysPerWeek: 6,
    upiId: "opsworker@upi",
  });

  await seedClaims({
    userId: primaryWorker.dbUser.id,
    policyId: primaryWorker.activePolicy.id,
    weeklyIncome: primaryWorker.profile.weeklyIncome,
    avgHoursPerDay: primaryWorker.profile.avgHoursPerDay,
    workDaysPerWeek: primaryWorker.profile.workDaysPerWeek,
    weeklyCoverage: primaryWorker.activePolicy.weeklyCoverage,
    trustScore: primaryWorker.profile.trustScore,
    externalId: "BLR-RAIN-IND-01",
  });

  await seedClaims({
    userId: secondWorker.dbUser.id,
    policyId: secondWorker.activePolicy.id,
    weeklyIncome: secondWorker.profile.weeklyIncome,
    avgHoursPerDay: secondWorker.profile.avgHoursPerDay,
    workDaysPerWeek: secondWorker.profile.workDaysPerWeek,
    weeklyCoverage: secondWorker.activePolicy.weeklyCoverage,
    trustScore: secondWorker.profile.trustScore,
    externalId: "DEL-AQI-DWK-01",
  });

  console.log("Seed complete - admin, worker profiles, weekly policies, triggers, and demo claims created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
