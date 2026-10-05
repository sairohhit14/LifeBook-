/**
 * Razorpay payment integration for LifeBook subscriptions.
 *
 * ponytail: plain REST + node crypto instead of the `razorpay` SDK — one fewer
 * dependency, same behavior. Order creation is server-side; payment verification
 * is a SHA-256 HMAC of `order_id|payment_id` with the key secret. Upgrade path:
 * also set RAZORPAY_WEBHOOK_SECRET so the webhook route in server.ts covers
 * payments whose browser never returns (closed tab, UPI intent apps).
 */
import crypto from "crypto";

export interface LifeBookPlan {
  name: string;            // plan tier label stored on the user
  amountPaise: number;     // Razorpay takes amounts in paise
  period: string;          // "Month" | "Year"
  storageExtraGB: number;  // extra storage granted over the 15 GB free tier
}

// Single source of truth — prices in paise (₹49 => 4900).
export const PLANS: Record<string, LifeBookPlan> = {
  "Basic Plan":  { name: "Basic Plan",  amountPaise: 4900,  period: "Month", storageExtraGB: 15 },
  "Silver Plan": { name: "Silver Plan", amountPaise: 12900, period: "Month", storageExtraGB: 50 },
  "Yearly Plan": { name: "Yearly Plan", amountPaise: 49900, period: "Year",  storageExtraGB: 30 },
};

// ponytail: every registered account begins with 1 GB of free cloud storage.
// When the user's usage reaches that ceiling, the UI directs them to the
// StoragePlans route so they can buy more. Razorpay orders grant the plan's
// storageExtraGB on top of this 1 GB base. Upgrade path: wire a real payment
// provider into the /api/subscription/* endpoints.
export function isRazorpayConfigured(): boolean {
  return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
}

function authHeader(): string {
  // Razorpay uses HTTP Basic auth with key_id:key_secret
  return "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
}

export async function createRazorpayOrder(plan: LifeBookPlan, receipt: string, notes: Record<string, string>) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: plan.amountPaise,
      currency: "INR",
      receipt,
      notes,
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order creation failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false; // length mismatch or malformed signature
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function storageLimitForPlan(planName: string, freeTierGB = 1): number {
  const plan = PLANS[planName];
  return plan ? freeTierGB + plan.storageExtraGB : freeTierGB;
}
