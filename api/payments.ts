import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPaymentGateway, CheckoutParams } from "./_lib/payment-gateway.js";
import { rateLimit } from "./_lib/rate-limit.js";
import { confirmPaymentBooking } from "./_lib/confirm-booking.js";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── checkout ───────────────────────────────────────────────────────────────────
const checkoutSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const checkoutSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let checkoutSupabase: any;
try {
  if (checkoutSupabaseUrl && checkoutSupabaseKey) {
    checkoutSupabase = createClient(checkoutSupabaseUrl, checkoutSupabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in checkout:", e);
}

export const checkoutHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!checkoutSupabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await checkoutSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Abuse protection: 10 checkouts per 10 minutes per client IP (each creates a
  // payment + hits the gateway, so cap cost-abuse). Applied after auth, before
  // the heavy DB/gateway work.
  const limit = rateLimit(req, { key: "checkout", windowMs: 10 * 60 * 1000, max: 10 });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  try {
    const { psychologist_id, booked_at, duration_minutes, full_name, phone, session_type } = req.body;

    if (!psychologist_id || !booked_at) {
      return res.status(400).json({ error: "psychologist_id and booked_at are required" });
    }

    const { data: psyProfile } = await checkoutSupabase
      .from("profiles")
      .select("price_individual, price_couples, price_adolescents")
      .eq("user_id", psychologist_id)
      .single();

    // Server-side price selection — never trust a client-sent price.
    const type = session_type === "couples" || session_type === "adolescents"
      ? session_type
      : "individual";
    let price: number | null = null;
    if (type === "couples") price = psyProfile?.price_couples ?? null;
    else if (type === "adolescents") price = psyProfile?.price_adolescents ?? null;
    else price = psyProfile?.price_individual ?? null;

    if (price == null) {
      return res.status(400).json({ error: "Ce type de séance n'est pas proposé" });
    }

    const { data: existing } = await checkoutSupabase
      .from("payments")
      .select("id, status")
      .eq("psychologist_id", psychologist_id)
      .eq("booked_at", booked_at)
      .in("status", ["initiated", "pending"])
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        const { data: stalePayment } = await checkoutSupabase
          .from("payments")
          .select("id, payment_url, cib_transaction_id")
          .eq("id", existing.id)
          .single();
        if (stalePayment?.payment_url) {
          return res.json({
            url: stalePayment.payment_url,
            payment_id: stalePayment.id,
            cib_transaction_id: stalePayment.cib_transaction_id,
            mock: !process.env.SOFIZPAY_PUBLIC_KEY,
          });
        }
      }
      await checkoutSupabase
        .from("payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    const { data: existingBooking } = await checkoutSupabase
      .from("bookings")
      .select("id")
      .eq("psychologist_id", psychologist_id)
      .eq("booked_at", booked_at)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingBooking) {
      return res.status(409).json({ error: "Ce créneau est déjà réservé." });
    }

    const { data: payment, error: insertError } = await checkoutSupabase
      .from("payments")
      .insert({
        patient_id: user.id,
        psychologist_id,
        booked_at,
        duration_minutes: duration_minutes || 60,
        price,
        status: "initiated",
      })
      .select()
      .single();

    if (insertError || !payment) {
      console.error("Payment insert error:", insertError);
      return res.status(500).json({ error: "Failed to create payment record" });
    }

    const origin = req.headers.origin || (req.headers.host
      ? `${req.headers.host.includes("localhost") ? "http" : "https"}://${req.headers.host}`
      : null);
    const FRONTEND_URL = origin || process.env.FRONTEND_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:8080");

    const returnUrl = `${FRONTEND_URL}/payment/return?payment_id=${payment.id}`;

    const gateway = getPaymentGateway();
    const isMock = !process.env.SOFIZPAY_PUBLIC_KEY;
    const result = await gateway.createCheckout({
      payment_id: payment.id,
      amount: price,
      full_name: full_name || "Patient",
      phone: phone || "0000000000",
      email: user.email || `patient-${user.id.slice(0, 8)}@majal.dz`,
      memo: `Majal - Séance thérapie`,
    }, returnUrl);

    await checkoutSupabase
      .from("payments")
      .update({
        sofizpay_transaction_id: result.cib_transaction_id,
        status: "pending",
      })
      .eq("id", payment.id);

    res.json({
      url: result.payment_url,
      payment_id: payment.id,
      cib_transaction_id: result.cib_transaction_id,
      mock: isMock,
    });
  } catch (err: any) {
    console.error("Checkout error:", err);
    const msg = err.message || "Internal server error";
    // Fail closed: an unconfigured gateway in production must not fall back to
    // the free mock. Surface it (402 mirrors a payment problem).
    if (msg === "Payment gateway not configured" || msg.includes("SofizPay")) {
      return res.status(402).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
};

// ── confirm ───────────────────────────────────────────────────────────────────
const confirmSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const confirmSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let confirmSupabase: any;
try {
  if (confirmSupabaseUrl && confirmSupabaseKey) {
    confirmSupabase = createClient(confirmSupabaseUrl, confirmSupabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in confirm:", e);
}

export const confirmHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!confirmSupabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await confirmSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const { payment_id } = req.body;

    const result = await confirmPaymentBooking(confirmSupabase, payment_id, user.id);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("Confirm error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

// ── webhook ─────────────────────────────────────────────────────────────────────
const webhookSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const webhookSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const webhookSupabase: SupabaseClient | null = (() => {
  if (!webhookSupabaseUrl || !webhookSupabaseKey) return null;
  try {
    return createClient(webhookSupabaseUrl, webhookSupabaseKey);
  } catch (e) {
    console.error("Failed to create Supabase client in payments/webhook:", e);
    return null;
  }
})();

export const webhookHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!webhookSupabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await webhookSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const paymentId = req.body?.payment_id || req.body?.booking_id;

  try {
    const result = await confirmPaymentBooking(webhookSupabase, paymentId, user.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  switch (action) {
    case "checkout":
      return checkoutHandler(req, res);
    case "confirm":
      return confirmHandler(req, res);
    case "webhook":
      return webhookHandler(req, res);
    default:
      return res.status(400).json({ error: "Unknown or missing action" });
  }
}
