import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPolicyContextForUser, syncPolicyForUser } from "@/lib/platformService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await getPolicyContextForUser(session.user.id);
  return NextResponse.json(context);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await syncPolicyForUser(session.user.id);
  const context = await getPolicyContextForUser(session.user.id);
  return NextResponse.json(context);
}
