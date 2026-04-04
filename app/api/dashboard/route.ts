import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/platformService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dashboard = await getDashboardForUser(session.user.id);
  return NextResponse.json(dashboard);
}
