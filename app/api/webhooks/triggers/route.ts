import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { ingestTriggerWebhookPayload, type TriggerWebhookPayload } from "@/lib/platformService";

const WEBHOOK_SECRET = process.env.TRIGGER_WEBHOOK_SECRET ?? "";
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function verifySignature(rawBody: string, timestamp: string, signature: string) {
  if (!WEBHOOK_SECRET || !timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function isTimestampValid(timestamp: string) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return false;

  const eventTimeMs = value > 1_000_000_000_000 ? value : value * 1000;
  return Math.abs(Date.now() - eventTimeMs) <= MAX_TIMESTAMP_SKEW_MS;
}

export async function POST(req: Request) {
  const timestamp = req.headers.get("x-trigger-timestamp") ?? "";
  const signature = req.headers.get("x-trigger-signature") ?? "";
  const rawBody = await req.text();

  if (!verifySignature(rawBody, timestamp, signature) || !isTimestampValid(timestamp)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: TriggerWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TriggerWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (!payload || !payload.provider || !Array.isArray(payload.events)) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const result = await ingestTriggerWebhookPayload(payload);
  return NextResponse.json({ ok: true, ...result });
}
