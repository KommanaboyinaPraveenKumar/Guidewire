import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const claims = await prisma.claim.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    claims.map((c) => ({
      id: c.id,
      amount: c.total_claim_amount,
      incidentType: c.incident_type,
      incidentSeverity: c.incident_severity,
      authoritiesContacted: c.authorities_contacted,
      riskScore: c.riskScore,
      riskLevel: c.riskLevel,
      flags: JSON.parse(c.flags),
      recommendation: c.recommendation,
      status: c.status,
      adminNote: c.adminNote,
      infoRequestNote: c.infoRequestNote,
      additionalDescription: c.additionalDescription,
      createdAt: c.createdAt,
      user: c.user,
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { claimId, action, adminNote, infoRequestNote } = await req.json();

  if (!claimId || !action) {
    return NextResponse.json({ error: "claimId and action are required" }, { status: 400 });
  }

  if (!["APPROVE", "REJECT", "REQUEST_INFO"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const nextStatus =
    action === "APPROVE" ? "APPROVED" :
    action === "REJECT" ? "REJECTED" :
    "INFO_REQUESTED";

  const updated = await prisma.claim.update({
    where: { id: claimId },
    data: {
      status: nextStatus,
      adminNote: adminNote ? String(adminNote).trim() : null,
      infoRequestNote: nextStatus === "INFO_REQUESTED" ? String(infoRequestNote || "").trim() : null,
    },
  });

  // Model training is now handled by the Python ML service
  return NextResponse.json({
    success: true,
    status: updated.status,
    adminNote: updated.adminNote,
    infoRequestNote: updated.infoRequestNote,
  });
}