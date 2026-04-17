type PayoutRequest = {
  claimId: string;
  amountInr: number;
  upiId: string;
  workerName: string;
  workerPhone?: string | null;
};

export type PayoutResult = {
  success: boolean;
  provider: string;
  reference: string | null;
  error?: string;
  raw?: unknown;
};

const ENABLE_REAL_PAYOUTS = process.env.ENABLE_REAL_PAYOUTS === "true";
const PAYOUT_PROVIDER = (process.env.PAYOUT_PROVIDER ?? "mock").toLowerCase();
const PAYOUT_FALLBACK_TO_MOCK = process.env.PAYOUT_FALLBACK_TO_MOCK !== "false";

const RAZORPAYX_BASE_URL = (process.env.RAZORPAYX_BASE_URL ?? "https://api.razorpay.com/v1").replace(/\/$/, "");
const RAZORPAYX_KEY_ID = process.env.RAZORPAYX_KEY_ID ?? "";
const RAZORPAYX_KEY_SECRET = process.env.RAZORPAYX_KEY_SECRET ?? "";
const RAZORPAYX_SOURCE_ACCOUNT_NUMBER = process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER ?? "";

const PAYOUT_WEBHOOK_URL = (process.env.PAYOUT_WEBHOOK_URL ?? "").replace(/\/$/, "");
const PAYOUT_WEBHOOK_TOKEN = process.env.PAYOUT_WEBHOOK_TOKEN ?? "";

function buildMockReference(prefix: string, claimId: string) {
  return `${prefix}-${claimId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function toPaise(amountInr: number) {
  return Math.max(100, Math.round(amountInr * 100));
}

function sanitizePhone(phone?: string | null) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D+/g, "");
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

async function razorpayRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const basicAuth = Buffer.from(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`).toString("base64");
  const response = await fetch(`${RAZORPAYX_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error?.description === "string" ? payload.error.description : "RazorpayX request failed.");
  }

  return payload as T;
}

async function issueRazorpayXPayout(input: PayoutRequest): Promise<PayoutResult> {
  if (!RAZORPAYX_KEY_ID || !RAZORPAYX_KEY_SECRET || !RAZORPAYX_SOURCE_ACCOUNT_NUMBER) {
    return {
      success: false,
      provider: "razorpayx",
      reference: null,
      error: "RazorpayX credentials are missing.",
    };
  }

  try {
    const contact = await razorpayRequest<{ id: string }>("/contacts", {
      name: input.workerName,
      type: "employee",
      reference_id: `contact-${input.claimId}`,
      contact: sanitizePhone(input.workerPhone),
      notes: { claimId: input.claimId, channel: "claim-secure" },
    });

    const fundAccount = await razorpayRequest<{ id: string }>("/fund_accounts", {
      contact_id: contact.id,
      account_type: "vpa",
      vpa: { address: input.upiId },
    });

    const payout = await razorpayRequest<{ id: string; status?: string }>("/payouts", {
      account_number: RAZORPAYX_SOURCE_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.id,
      amount: toPaise(input.amountInr),
      currency: "INR",
      mode: "UPI",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: input.claimId,
      narration: "Claim payout",
      notes: {
        claimId: input.claimId,
        worker: input.workerName,
      },
    });

    return {
      success: true,
      provider: "razorpayx",
      reference: `RZP-${payout.id}`,
      raw: payout,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: "razorpayx",
      reference: null,
      error: error?.message ?? "RazorpayX payout failed.",
    };
  }
}

async function issueWebhookPayout(input: PayoutRequest): Promise<PayoutResult> {
  if (!PAYOUT_WEBHOOK_URL || !PAYOUT_WEBHOOK_TOKEN) {
    return {
      success: false,
      provider: "webhook",
      reference: null,
      error: "Payout webhook configuration is missing.",
    };
  }

  try {
    const response = await fetch(PAYOUT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYOUT_WEBHOOK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        claimId: input.claimId,
        amountInr: input.amountInr,
        upiId: input.upiId,
        workerName: input.workerName,
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload?.message === "string" ? payload.message : "Payout webhook failed.");
    }

    return {
      success: true,
      provider: "webhook",
      reference:
        typeof payload?.reference === "string"
          ? payload.reference
          : buildMockReference("PAY", input.claimId),
      raw: payload,
    };
  } catch (error: any) {
    return {
      success: false,
      provider: "webhook",
      reference: null,
      error: error?.message ?? "Webhook payout failed.",
    };
  }
}

export async function issueClaimPayout(input: PayoutRequest): Promise<PayoutResult> {
  if (!ENABLE_REAL_PAYOUTS || PAYOUT_PROVIDER === "mock") {
    return {
      success: true,
      provider: "mock",
      reference: buildMockReference("UPI", input.claimId),
    };
  }

  const realResult =
    PAYOUT_PROVIDER === "razorpayx"
      ? await issueRazorpayXPayout(input)
      : await issueWebhookPayout(input);

  if (realResult.success || !PAYOUT_FALLBACK_TO_MOCK) {
    return realResult;
  }

  return {
    success: true,
    provider: "mock-fallback",
    reference: buildMockReference("UPI", input.claimId),
    error: realResult.error,
  };
}
