import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ClaimInput, MLPredictionResponse } from "@/types/claim";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateMonthsAsCustomer(bindDate: string) {
  const date = new Date(bindDate);
  if (Number.isNaN(date.getTime())) return 0;

  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12;
  months += now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  return Math.max(0, months);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: ClaimInput = await req.json();
  const userId = session.user.id;
  const injuryClaim = toNumber(body.injury_claim);
  const propertyClaim = toNumber(body.property_claim);
  const vehicleClaim = toNumber(body.vehicle_claim);
  const totalClaimAmount = injuryClaim + propertyClaim + vehicleClaim;
  const monthsAsCustomer = calculateMonthsAsCustomer(body.policy_bind_date);
  
  // Verify user exists in database
  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    return NextResponse.json(
      { error: `User not found (${userId}). Please log out and log back in.` },
      { status: 400 }
    );
  }

  try {
    // Call Python ML service
    const mlRes = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        months_as_customer: body.months_as_customer,
        age: body.age,
        policy_bind_date: body.policy_bind_date,
        policy_annual_premium: body.policy_annual_premium,
        umbrella_limit: body.umbrella_limit ?? 0,
        incident_type: body.incident_type,
        collision_type: body.collision_type,
        incident_severity: body.incident_severity,
        authorities_contacted: body.authorities_contacted,
        incident_hour_of_the_day: body.incident_hour_of_the_day,
        number_of_vehicles_involved: body.number_of_vehicles_involved,
        property_damage: body.property_damage,
        bodily_injuries: body.bodily_injuries ?? 0,
        witnesses: body.witnesses,
        police_report_available: body.police_report_available,
        total_claim_amount: totalClaimAmount,
        injury_claim: injuryClaim,
        property_claim: propertyClaim,
        vehicle_claim: vehicleClaim,
        auto_year: body.auto_year,
        capital_gains: body.capital_gains ?? 0,
        capital_loss: body.capital_loss ?? 0,
        policy_deductable: body.policy_deductable ?? 1000,
      }),
    });

    if (!mlRes.ok) {
      const errorText = await mlRes.text();
      console.error("ML Service error:", errorText);
      return NextResponse.json(
        { error: "ML service unavailable. Is it running on port 8000?" },
        { status: 503 }
      );
    }

    const ml: MLPredictionResponse = await mlRes.json();

    // Store claim in database with full ML model data
    const claim = await prisma.claim.create({
      data: {
        userId,
        months_as_customer: monthsAsCustomer,
        age: body.age,
        policy_bind_date: body.policy_bind_date,
        policy_annual_premium: body.policy_annual_premium,
        umbrella_limit: body.umbrella_limit || 0,
        incident_type: body.incident_type,
        collision_type: body.collision_type,
        incident_severity: body.incident_severity,
        authorities_contacted: body.authorities_contacted,
        incident_hour_of_the_day: body.incident_hour_of_the_day,
        number_of_vehicles_involved: body.number_of_vehicles_involved,
        property_damage: body.property_damage,
        bodily_injuries: body.bodily_injuries || 0,
        witnesses: body.witnesses,
        police_report_available: body.police_report_available,
        total_claim_amount: totalClaimAmount,
        injury_claim: injuryClaim,
        property_claim: propertyClaim,
        vehicle_claim: vehicleClaim,
        auto_year: body.auto_year,
        capital_gains: body.capital_gains || 0,
        capital_loss: body.capital_loss || 0,
        policy_deductable: body.policy_deductable || 1000,
        fraud_probability: ml.fraud_probability,
        riskScore: ml.risk_score,
        riskLevel: ml.risk_level,
        is_fraud: ml.is_fraud,
        flags: JSON.stringify(ml.flags),
        recommendation: ml.recommendation,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      id: claim.id,
      fraud_probability: ml.fraud_probability,
      risk_score: ml.risk_score,
      risk_level: ml.risk_level,
      is_fraud: ml.is_fraud,
      flags: ml.flags,
      recommendation: ml.recommendation,
      status: claim.status,
      timestamp: claim.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Error analyzing claim:", error);
    return NextResponse.json(
      { error: "Failed to analyze claim: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = await prisma.claim.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    claims.map((c) => ({
      id: c.id,
      months_as_customer: c.months_as_customer,
      age: c.age,
      policy_bind_date: c.policy_bind_date,
      policy_annual_premium: c.policy_annual_premium,
      umbrella_limit: c.umbrella_limit,
      incident_type: c.incident_type,
      collision_type: c.collision_type,
      incident_severity: c.incident_severity,
      authorities_contacted: c.authorities_contacted,
      incident_hour_of_the_day: c.incident_hour_of_the_day,
      number_of_vehicles_involved: c.number_of_vehicles_involved,
      property_damage: c.property_damage,
      bodily_injuries: c.bodily_injuries,
      witnesses: c.witnesses,
      police_report_available: c.police_report_available,
      total_claim_amount: c.total_claim_amount,
      injury_claim: c.injury_claim,
      property_claim: c.property_claim,
      vehicle_claim: c.vehicle_claim,
      auto_year: c.auto_year,
      capital_gains: c.capital_gains,
      capital_loss: c.capital_loss,
      policy_deductable: c.policy_deductable,
      fraud_probability: c.fraud_probability,
      risk_score: c.riskScore,
      risk_level: c.riskLevel,
      is_fraud: c.is_fraud,
      flags: JSON.parse(c.flags),
      recommendation: c.recommendation,
      status: c.status,
      adminNote: c.adminNote,
      infoRequestNote: c.infoRequestNote,
      additionalDescription: c.additionalDescription,
      timestamp: c.createdAt.toISOString(),
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId, additionalDescription } = await req.json();
  if (!claimId) return NextResponse.json({ error: "Claim id is required" }, { status: 400 });

  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim || claim.userId !== session.user.id) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status !== "INFO_REQUESTED") {
    return NextResponse.json({ error: "This claim is not awaiting additional info" }, { status: 400 });
  }

  const updated = await prisma.claim.update({
    where: { id: claimId },
    data: {
      additionalDescription: String(additionalDescription || "").trim(),
      status: "PENDING",
    },
  });

  return NextResponse.json({
    success: true,
    status: updated.status,
    additionalDescription: updated.additionalDescription,
  });
}