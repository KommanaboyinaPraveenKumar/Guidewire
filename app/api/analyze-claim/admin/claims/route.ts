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

  return NextResponse.json(claims.map((c) => ({ ...c, flags: JSON.parse(c.flags) })));
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { claimId, status, adminNote } = await req.json();

  await prisma.claim.update({
    where: { id: claimId },
    data: { status, adminNote },
  });

  // Model training is now handled by the Python ML service
  return NextResponse.json({ success: true });
}