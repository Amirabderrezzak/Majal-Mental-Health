import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendContactFormEmail } from "./_lib/email.js";
import { rateLimit } from "./_lib/rate-limit.js";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Spam protection: 5 contact submissions per 10 minutes per client IP.
  const limit = rateLimit(req, { key: "contact", windowMs: 10 * 60 * 1000, max: 5 });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Tous les champs sont requis." });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }

  try {
    await sendContactFormEmail({ name, email, subject, message });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to send contact form email:", err);
    return res.status(500).json({ error: "Échec de l'envoi du message." });
  }
}
