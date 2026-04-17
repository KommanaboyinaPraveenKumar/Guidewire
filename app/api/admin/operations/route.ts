import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  forceRefreshTriggerCatalog,
  getAdminOperations,
  reviewClaimAction,
  updatePolicyStatus,
  updateTriggerStatus,
} from "@/lib/platformService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getAdminOperations();
  return NextResponse.json(payload);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  try {
    if (body.entity === "trigger") {
      const result = await updateTriggerStatus(String(body.id), Boolean(body.isActive));
      return NextResponse.json(result);
    }

    if (body.entity === "policy") {
      const status = body.status === "ACTIVE" ? "ACTIVE" : "PAUSED";
      const result = await updatePolicyStatus(String(body.id), status);
      return NextResponse.json(result);
    }

    if (body.entity === "claim") {
      const action = body.action as "APPROVE" | "BLOCK" | "REOPEN";
      if (!["APPROVE", "BLOCK", "REOPEN"].includes(action)) {
        return NextResponse.json({ error: "Invalid claim action" }, { status: 400 });
      }

      const result = await reviewClaimAction(String(body.id), action);
      return NextResponse.json(result);
    }

    if (body.entity === "trigger_sync") {
      const result = await forceRefreshTriggerCatalog();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported admin action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Admin action failed" }, { status: 500 });
  }
}
