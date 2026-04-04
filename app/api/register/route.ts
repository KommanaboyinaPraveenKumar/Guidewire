import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createProfileAndPolicy } from "@/lib/platformService";
import type { WorkerProfileInput } from "@/types/platform";

export async function POST(req: NextRequest) {
  const body: WorkerProfileInput = await req.json();
  const {
    name,
    email,
    password,
    phone,
    city,
    zone,
    platform,
    vehicleType,
    weeklyIncome,
    avgHoursPerDay,
    workDaysPerWeek,
    upiId,
  } = body;

  if (
    !name ||
    !email ||
    !password ||
    !phone ||
    !city ||
    !zone ||
    !platform ||
    !vehicleType ||
    !upiId
  ) {
    return NextResponse.json({ error: "All onboarding fields are required." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "USER" },
  });

  await createProfileAndPolicy(user.id, {
    name,
    email,
    password,
    phone,
    city,
    zone,
    platform,
    vehicleType,
    weeklyIncome: Number(weeklyIncome),
    avgHoursPerDay: Number(avgHoursPerDay),
    workDaysPerWeek: Number(workDaysPerWeek),
    upiId,
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
