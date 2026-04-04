import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClaimsForUser, runAutomationForUser, simulateDisruptionForUser } from "@/lib/platformService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = await getClaimsForUser(session.user.id);
  return NextResponse.json(claims);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.mode === "simulate") {
    const result = await simulateDisruptionForUser(session.user.id);
    return NextResponse.json(result);
  }

  const result = await runAutomationForUser(session.user.id);
  return NextResponse.json(result);
}
