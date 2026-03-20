import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ClaimInput, MLPredictionResponse } from "@/types/claim";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: ClaimInput = await req.json();
  const userId = session.user.id;
  
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
        total_claim_amount: body.total_claim_amount,
        injury_claim: body.injury_claim,
        property_claim: body.property_claim,
        vehicle_claim: body.vehicle_claim,
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
        months_as_customer: body.months_as_customer,
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
        total_claim_amount: body.total_claim_amount,
        injury_claim: body.injury_claim,
        property_claim: body.property_claim,
        vehicle_claim: body.vehicle_claim,
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
        status: ml.risk_level === "CRITICAL" ? "FLAGGED" : "PENDING",
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
      ...c,
      flags: JSON.parse(c.flags),
    }))
  );
}