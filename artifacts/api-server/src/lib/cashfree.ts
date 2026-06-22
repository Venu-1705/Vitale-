// =============================================================================
// Vitalé — Cashfree Payment Gateway integration (server-side, sandbox/prod)
// -----------------------------------------------------------------------------
// Thin, configuration-checked wrapper over the official `cashfree-pg` SDK plus a
// dependency-free webhook signature verifier. Credentials are read ONLY from the
// environment and never logged:
//   • CASHFREE_APP_ID      — the PG client id (a.k.a. x-client-id)
//   • CASHFREE_SECRET_KEY  — the PG client secret (a.k.a. x-client-secret)
//   • CASHFREE_ENV         — "PRODUCTION" → live, anything else → SANDBOX (TEST)
//
// The installed SDK (cashfree-pg v4) exposes a STATIC client configured via
// `Cashfree.XClientId` / `XClientSecret` / `XEnvironment`, with versioned methods
// `PGCreateOrder(apiVersion, req)` / `PGFetchOrder(apiVersion, orderId)`.
//
// Money note: the platform stores money in PAISE (integer). Cashfree's PG Orders
// API takes `order_amount` in RUPEES (decimal). Convert at this boundary only.
// =============================================================================
import crypto from "node:crypto";
import { Cashfree, CFEnvironment } from "cashfree-pg";

const APP_ID = process.env["CASHFREE_APP_ID"]?.trim();
const SECRET_KEY = process.env["CASHFREE_SECRET_KEY"]?.trim();
const ENV =
  process.env["CASHFREE_ENV"]?.trim().toUpperCase() === "PRODUCTION"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX; // default to SANDBOX unless explicitly PRODUCTION

// Pinned PG API version (date-stamped contract Cashfree requires on every call).
const API_VERSION = "2023-08-01";

/** True only when both credentials are present — callers should 503 otherwise. */
export function isCashfreeConfigured(): boolean {
  return Boolean(APP_ID && SECRET_KEY);
}

let configured = false;

/** Lazily apply the static SDK configuration; throws a clear error when unconfigured. */
function ensureConfigured(): void {
  if (!APP_ID || !SECRET_KEY) {
    throw new Error("Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.");
  }
  if (configured) return;
  Cashfree.XClientId = APP_ID;
  Cashfree.XClientSecret = SECRET_KEY;
  Cashfree.XEnvironment = ENV;
  configured = true;
}

export interface CreateOrderInput {
  /** Our shop_orders.id — used as the Cashfree order_id so the webhook can map back. */
  orderId: string;
  /** Order total in PAISE (integer) — converted to rupees for Cashfree. */
  amountPaise: number;
  customerId: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerName?: string | null;
  /** Optional deep-link the hosted checkout returns to (mobile WebView sentinel). */
  returnUrl?: string;
  /** Optional server-to-server webhook URL (Cashfree dashboard can also set this). */
  notifyUrl?: string;
}

export interface CreateOrderResult {
  orderId: string;
  paymentSessionId: string;
}

/**
 * Create a Cashfree PG order for one of our shop orders. The amount and identity
 * are server-supplied (never trusted from the client). Returns the gateway order
 * id + the `payment_session_id` the client SDK/WebView needs to render checkout.
 */
export async function createCashfreeOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  ensureConfigured();
  // Cashfree requires a non-empty phone; fall back to a placeholder the dashboard accepts.
  const phone = (input.customerPhone && input.customerPhone.trim()) || "9999999999";

  const resp = await Cashfree.PGCreateOrder(API_VERSION, {
    order_id: input.orderId,
    order_amount: Number((input.amountPaise / 100).toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id: input.customerId,
      customer_phone: phone,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      ...(input.customerName ? { customer_name: input.customerName } : {}),
    },
    order_meta: {
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
    },
  });

  const data = resp.data ?? {};
  const sessionId = data.payment_session_id;
  const orderId = data.order_id;
  if (!sessionId || !orderId) {
    throw new Error("Cashfree did not return a payment session.");
  }
  return { orderId: String(orderId), paymentSessionId: String(sessionId) };
}

export interface FetchOrderResult {
  orderId: string;
  /** Cashfree order status: ACTIVE | PAID | EXPIRED | TERMINATED | TERMINATION_REQUESTED. */
  orderStatus: string;
  orderAmount: number | null;
}

/** Fetch the authoritative payment status of a Cashfree order. */
export async function fetchCashfreeOrder(orderId: string): Promise<FetchOrderResult> {
  ensureConfigured();
  const resp = await Cashfree.PGFetchOrder(API_VERSION, orderId);
  const data = resp.data ?? {};
  return {
    orderId: String(data.order_id ?? orderId),
    orderStatus: String(data.order_status ?? "UNKNOWN"),
    orderAmount: typeof data.order_amount === "number" ? data.order_amount : null,
  };
}

/**
 * Verify a Cashfree webhook signature.
 *
 * Cashfree signs each webhook as:
 *   base64( HMAC_SHA256( secretKey, timestamp + rawBody ) )
 * sent in the `x-webhook-signature` header, with `x-webhook-timestamp` carrying the
 * timestamp. We recompute over the RAW request body (never the re-serialized JSON)
 * and compare in constant time. Implemented with core crypto so it is independent of
 * SDK internals. Returns false on any mismatch or missing input.
 */
export function verifyWebhookSignature(
  signature: string | undefined,
  rawBody: string,
  timestamp: string | undefined,
): boolean {
  if (!signature || !timestamp || !SECRET_KEY) return false;
  const expected = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(timestamp + rawBody)
    .digest("base64");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
