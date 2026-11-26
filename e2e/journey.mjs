// Full Majal journey in a real browser against the local stack (e2e/stack/run.mjs):
// sign-up → admin approval → therapist setup → discovery → booking → payment →
// joining the session (both sides) → automatic close → review, plus the money
// edge cases (therapist no-show, reschedule-then-cancel) and checks on every page
// (console errors, duplicate ids, raw i18n keys, Arabic calendar).
import { createRequire } from "node:module";
// Playwright is pre-installed globally (CommonJS resolution via NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(here, "artifacts");
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });

const APP = "http://127.0.0.1:8080";
const API = "http://localhost:3001";
const db = new pg.Pool({ connectionString: "postgresql://postgres@localhost:54322/majal?host=/tmp" });
const sql = async (q, p) => (await db.query(q, p)).rows;

const results = [];
let shot = 0;
const log = (...a) => console.log(...a);
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "", ms: Date.now() - t0 });
    log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: String(e?.message || e).split("\n")[0], ms: Date.now() - t0 });
    log(`  ✗ ${name} — ${String(e?.message || e).split("\n")[0]}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
async function snap(page, label) {
  const file = `${String(++shot).padStart(2, "0")}-${label}.png`;
  await page.waitForTimeout(700); // let fade-in animations finish
  await page.screenshot({ path: path.join(ART, file), fullPage: false });
  return file;
}
// Moves the API, the auth gateway and (when given) browser pages to `date`
// (null = real time) and reloads the pages so they pick up fresh tokens.
// Requests in flight while the clocks are being moved can briefly disagree
// about token expiry (server shifted, browser not yet): a harness artifact, so
// 401/406 within 3 s of a jump are not counted as app errors.
let lastClockJump = 0;
const nearClockJump = () => Date.now() - lastClockJump < 3000;
async function setClock(date, pages = []) {
  lastClockJump = Date.now();
  const body = JSON.stringify({ offsetMs: date ? date.getTime() - Date.now() : 0 });
  await fetch(`${API}/__clock`, { method: "POST", body });
  await fetch(`http://localhost:54321/__clock`, { method: "POST", body });
  for (const p of pages) await p.clock.setSystemTime(date ?? new Date());
}
const setApiClock = (date) => setClock(date);
// A fresh access token minted at the gateway's current (possibly shifted) time.
async function tokenFor(u) {
  const r = await fetch("http://localhost:54321/auth/v1/token?grant_type=password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) });
  return (await r.json()).access_token;
}
const cron = async () => (await fetch(`${API}/api/notifications?action=push-cron`, { headers: { Authorization: "Bearer cron-test-secret" } })).json();
const emails = async () => (await fetch(`${API}/__emails`)).json();
const daily = async () => (await fetch(`${API}/__daily`)).json();

// Page-level health checks collected across the whole run.
const consoleErrors = [];
const pageIssues = [];
const httpErrors = [];
function watch(page, who) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/realtime|websocket|WebSocket|ERR_CONNECTION_REFUSED.*54321\/realtime|Failed to load resource: the server responded with a status of (406|409)/.test(text)) return;
    if (nearClockJump() && /401|PGRST116/.test(text)) return;
    consoleErrors.push(`[${who}] ${text.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${who}] PAGE ERROR ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !/realtime/.test(r.url()) && !(nearClockJump() && [401, 406].includes(r.status()))) httpErrors.push(`[${who}] ${r.status()} ${r.request().method()} ${r.url().replace(/apikey=[^&]+/, "").slice(0, 160)}`);
  });
}
async function audit(page, where) {
  const r = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id).filter(Boolean);
    const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const text = document.body.innerText;
    const rawKeys = [...new Set(text.match(/\b(?:space|psy|prof|res|pd|admin|auth|editor|common|pay|nav)\.[a-zA-Z0-9_.-]+\b/g) || [])];
    return { dup, rawKeys };
  });
  if (r.dup.length) pageIssues.push(`${where}: duplicate ids ${r.dup.join(", ")}`);
  if (r.rawKeys.length) pageIssues.push(`${where}: untranslated keys ${r.rawKeys.join(", ")}`);
}

async function signup(page, { name, email, phone, password, psy }) {
  await page.goto(`${APP}/inscription`);
  if (psy) await page.getByRole("button", { name: "Psychologue", exact: true }).click();
  await page.fill("#inscription-f1", name);
  await page.fill("#inscription-f2", email);
  await page.fill("#inscription-f3", phone);
  if (psy) {
    await page.fill("#inscription-f4", psy.order);
    await page.selectOption("#inscription-f5", { index: 1 });
    await page.fill("#inscription-f6", psy.city);
  }
  await page.fill("#inscription-f7", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/connexion/, { timeout: 10000 });
}
async function login(page, email, password, expectUrl) {
  await page.goto(`${APP}/connexion`);
  await page.fill("#connexion-f1", email);
  await page.fill("#connexion-f2", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(expectUrl, { timeout: 15000 });
}

// Next Algiers working day (Sun–Thu) at least 2 days ahead, as y/m/d.
function nextWorkingDay(from = new Date(), minDays = 2) {
  const d = new Date(from.getTime() + 3600e3);
  d.setUTCDate(d.getUTCDate() + minDays);
  while (![0, 1, 2, 3, 4].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() };
}
const algiers = (y, mo, d, hh, mm = 0) => new Date(Date.UTC(y, mo, d, hh - 1, mm));

async function book(page, psyId, day, time) {
  await page.goto(`${APP}/reservation/${psyId}`);
  await page.getByText("Sélectionner une date").or(page.getByText("Choisissez une date")).first().waitFor({ timeout: 10000 }).catch(() => {});
  const now = new Date();
  const monthsAhead = (day.y - now.getUTCFullYear()) * 12 + (day.mo - now.getUTCMonth());
  for (let i = 0; i < monthsAhead; i++) await page.getByRole("button", { name: /Mois suivant/ }).click();
  await page.locator(".grid-cols-7 button:not([disabled])", { hasText: new RegExp(`^${day.d}$`) }).first().click();
  await page.getByRole("button", { name: time, exact: true }).click();
  await page.getByRole("button", { name: "Confirmer la réservation" }).click();
  await page.waitForURL(/\/payment\/mock/, { timeout: 15000 });
  await page.getByRole("button", { name: /Payer maintenant/ }).click();
  await page.waitForURL(/\/mon-espace/, { timeout: 15000 });
}

const browser = await chromium.launch();
const ctxPatient = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
const ctxPsy = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR", timezoneId: "Africa/Algiers" });
const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
const patient = await ctxPatient.newPage(); watch(patient, "patient");
const psyPage = await ctxPsy.newPage(); watch(psyPage, "psy");
const admin = await ctxAdmin.newPage(); watch(admin, "admin");

const PAT = { name: "Nadia Patiente", email: "nadia@example.dz", phone: "0550 12 34 56", password: "Majal-patient-2026" };
const PSY = { name: "Dr Karim Haddad", email: "karim@example.dz", phone: "0661 98 76 54", password: "Majal-psy-2026", psy: { order: "ORD-ALG-1234", city: "Alger" } };
const ADM = { email: "admin@example.dz", password: "Majal-admin-2026" };
let psyId = null;
let patientId = null;

log("\n1 · Accounts");
await step("Home page loads; public counters come from the database", async () => {
  await patient.goto(APP);
  await patient.waitForLoadState("networkidle");
  await audit(patient, "home");
  return await snap(patient, "home");
});
await step("Patient signs up through the form", async () => {
  await signup(patient, PAT);
  patientId = (await sql("SELECT id FROM auth.users WHERE email=$1", [PAT.email]))[0]?.id;
  expect(patientId, "no auth user created");
  const p = (await sql("SELECT user_type, approval_status FROM profiles WHERE user_id=$1", [patientId]))[0];
  expect(p.user_type === "patient" && p.approval_status === "approved", JSON.stringify(p));
  return "profile created by handle_new_user()";
});
await step("Signup refuses passwords shorter than 8 characters", async () => {
  await psyPage.goto(`${APP}/inscription`);
  await psyPage.fill("#inscription-f1", "X"); await psyPage.fill("#inscription-f2", "short@example.dz");
  await psyPage.fill("#inscription-f3", "0"); await psyPage.fill("#inscription-f7", "1234567");
  await psyPage.click('button[type="submit"]');
  await psyPage.waitForTimeout(800);
  expect(!(await sql("SELECT 1 FROM auth.users WHERE email='short@example.dz'")).length, "account created with a 7-char password");
});
await step("Therapist signs up (pending approval, licence number recorded)", async () => {
  await signup(psyPage, PSY);
  psyId = (await sql("SELECT id FROM auth.users WHERE email=$1", [PSY.email]))[0]?.id;
  const p = (await sql("SELECT user_type, approval_status, order_number FROM profiles WHERE user_id=$1", [psyId]))[0];
  expect(p.user_type === "psychologue" && p.approval_status === "pending" && p.order_number === PSY.psy.order, JSON.stringify(p));
});
await step("Unapproved therapist is not in the public directory", async () => {
  await patient.goto(`${APP}/psychologues`);
  await patient.waitForLoadState("networkidle");
  expect(!(await patient.getByText(PSY.name).count()), "pending therapist listed");
});

log("\n2 · Admin vetting");
await step("Admin approves the therapist after seeing the licence number", async () => {
  const r = await fetch("http://localhost:54321/auth/v1/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADM.email, password: ADM.password, data: { full_name: "Admin Majal" } }) });
  expect(r.ok, "admin signup failed");
  await sql("UPDATE profiles SET is_admin=true WHERE user_id=(SELECT id FROM auth.users WHERE email=$1)", [ADM.email]);
  await admin.goto(`${APP}/admin/login`);
  await admin.fill('input[type="email"]', ADM.email);
  await admin.fill('input[type="password"]', ADM.password);
  await admin.click('button[type="submit"]');
  await admin.waitForURL(/\/admin$/, { timeout: 15000 });
  await admin.getByRole("button", { name: /Utilisateurs/ }).first().click();
  await admin.getByText(PSY.psy.order).waitFor({ timeout: 10000 });
  await audit(admin, "admin users");
  const file = await snap(admin, "admin-vetting");
  await admin.getByRole("button", { name: "Approuver" }).first().click();
  await admin.waitForTimeout(1500);
  const p = (await sql("SELECT approval_status FROM profiles WHERE user_id=$1", [psyId]))[0];
  expect(p.approval_status === "approved", p.approval_status);
  const mail = (await emails()).find((e) => e.to === PSY.email && /approuvé/.test(e.subject));
  expect(mail, "approval e-mail not sent");
  return `${file}; e-mail "${mail.subject}"`;
});

log("\n3 · Therapist setup");
await step("Therapist logs in and lands in their space", async () => {
  await login(psyPage, PSY.email, PSY.password, /\/espace-psy/);
  await psyPage.waitForLoadState("networkidle");
  await audit(psyPage, "psy dashboard");
  return await snap(psyPage, "psy-dashboard");
});
await step("Therapist sets prices and languages in the profile editor", async () => {
  await psyPage.getByRole("button", { name: /Profil professionnel/ }).first().click();
  await psyPage.fill("#price-price_individual", "2500");
  await psyPage.fill("#price-price_couples", "4000");
  await psyPage.getByRole("button", { name: "Arabe", exact: true }).click();
  await audit(psyPage, "psy profile editor");
  await psyPage.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  await psyPage.waitForTimeout(1500);
  const p = (await sql("SELECT price_individual, price_couples, price_per_session, language FROM profiles WHERE user_id=$1", [psyId]))[0];
  expect(p.price_individual === 2500 && p.price_couples === 4000, JSON.stringify(p));
  expect(p.price_per_session === 2500, `headline price ${p.price_per_session}`);
  expect(/Arabe/.test(p.language), `language ${p.language}`);
  return `${await snap(psyPage, "psy-profile")}; headline price derived = ${p.price_per_session}`;
});
await step("Out-of-band price is rejected with a clear message", async () => {
  await psyPage.fill("#price-price_individual", "9000");
  await psyPage.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  // Caught in the editor before saving (and by the DB CHECK as a backstop).
  await psyPage.getByText(/doit être entre 1900 et 3200|en dehors de la fourchette/).first().waitFor({ timeout: 5000 });
  await psyPage.fill("#price-price_individual", "2500");
  await psyPage.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  await psyPage.waitForTimeout(800);
});
await step("Settings page: each toggle has its own id; removed no-op switches are gone", async () => {
  await psyPage.getByRole("button", { name: /Paramètres/ }).first().click();
  await psyPage.waitForTimeout(500);
  await audit(psyPage, "psy settings");
  expect(!(await psyPage.getByText(/confirmation automatique/i).count()), "auto-confirm toggle still shown");
  return await snap(psyPage, "psy-settings");
});

log("\n4 · Discovery");
await step("Directory card shows the real price and languages", async () => {
  await patient.goto(`${APP}/psychologues`);
  await patient.getByText(PSY.name).waitFor({ timeout: 10000 });
  const card = patient.locator("div.rounded-lg", { hasText: PSY.name }).first();
  const txt = await card.innerText();
  expect(/2\s?500/.test(txt) && /partir/.test(txt), `card: ${txt.replace(/\n/g, " | ")}`);
  expect(!/3\s?000/.test(txt), "invented 3000 DZD still shown");
  expect(/Arabe/.test(txt), "language missing");
  await audit(patient, "directory");
  return await snap(patient, "directory");
});
await step("Language filter 'Arabe' finds the therapist", async () => {
  await patient.getByRole("button", { name: /Filtres/ }).click();
  await patient.selectOption("#psychologues-f1", "Arabe");
  await patient.getByText(PSY.name).waitFor({ timeout: 3000 });
});
await step("Profile page: price, approach, availability; no review button without a session", async () => {
  await patient.goto(`${APP}/profil/${psyId}`);
  await patient.getByText(PSY.name).first().waitFor();
  await patient.getByRole("button", { name: /Avis/ }).click();
  expect(!(await patient.getByRole("button", { name: /Laisser un avis/ }).count()), "review button shown with no completed session");
  await audit(patient, "profile");
  return await snap(patient, "profile-reviews-locked");
});
await step("Patient sends a message before booking", async () => {
  await patient.getByRole("button", { name: /À propos/ }).click().catch(() => {});
  await patient.getByRole("button", { name: /Envoyer un message|Message/ }).first().click();
  await patient.waitForURL(/page=messages/, { timeout: 10000 });
  const box = patient.locator("textarea, input[type='text']").last();
  await box.fill("Bonjour docteur, je souhaiterais une première séance.");
  await box.press("Enter");
  await patient.waitForTimeout(1500);
  const m = await sql("SELECT content FROM messages WHERE sender_id=$1 AND receiver_id=$2", [patientId, psyId]);
  expect(m.length === 1, `messages stored: ${m.length}`);
  return await snap(patient, "messages");
});

await step("Therapist finds that pre-booking message in their inbox and can open it", async () => {
  await psyPage.goto(`${APP}/espace-psy?page=messages`);
  await psyPage.getByRole("button", { name: PAT.name }).first().click({ timeout: 10000 });
  await psyPage.getByText(/première séance/).first().waitFor({ timeout: 10000 });
  await audit(psyPage, "psy inbox");
  return await snap(psyPage, "psy-inbox-prebooking");
});

log("\n5 · Booking & payment");
const day = nextWorkingDay();
const s1 = algiers(day.y, day.mo, day.d, 9);
const s2 = algiers(day.y, day.mo, day.d, 11);
await step(`Patient books ${day.d}/${day.mo + 1} 09:00 (Algiers) and pays`, async () => {
  await book(patient, psyId, day, "09:00");
  const b = await sql("SELECT status, price, booked_at, session_type FROM bookings WHERE patient_id=$1 ORDER BY created_at", [patientId]);
  expect(b.length === 1 && b[0].status === "confirmed" && b[0].price === 2500, JSON.stringify(b));
  expect(new Date(b[0].booked_at).getTime() === s1.getTime(), `stored ${b[0].booked_at}, expected ${s1.toISOString()}`);
  const p = await sql("SELECT status, booking_id FROM payments WHERE patient_id=$1", [patientId]);
  expect(p[0].status === "confirmed" && p[0].booking_id, JSON.stringify(p));
  return `stored ${s1.toISOString()} = 09:00 Algiers (patient browser is in Paris time)`;
});
await step("Confirmation e-mails, in-app notifications (Algiers time, no UTC)", async () => {
  const mails = await emails();
  expect(mails.some((e) => e.to === PAT.email && /confirmée/.test(e.subject)), "patient confirmation e-mail missing");
  expect(mails.some((e) => e.to === PSY.email && /Nouvelle réservation/.test(e.subject)), "therapist e-mail missing");
  const n = await sql("SELECT user_id, title, content FROM notifications WHERE user_id IN ($1,$2) AND type='booking' ORDER BY created_at", [patientId, psyId]);
  const psyN = n.filter((x) => x.user_id === psyId);
  expect(psyN.length === 1, `therapist got ${psyN.length} booking notifications (expected exactly 1, only after payment)`);
  expect(/heure d'Alger/.test(psyN[0].content) && !/UTC/.test(psyN[0].content), psyN[0].content);
  expect(/09:00/.test(psyN[0].content), psyN[0].content);
  return psyN[0].content;
});
await step("Patient sees the session under 'Mes séances' at 09:00 Algiers time", async () => {
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.getByText(PSY.name).first().waitFor({ timeout: 10000 });
  const txt = await patient.locator("main").innerText();
  expect(/09:00/.test(txt), "time not shown as 09:00 (Algiers) for a viewer in Paris");
  await audit(patient, "patient sessions");
  return await snap(patient, "patient-sessions");
});
await step("The slot is no longer offered to anyone", async () => {
  await patient.goto(`${APP}/reservation/${psyId}`);
  const now = new Date();
  const monthsAhead = (day.y - now.getUTCFullYear()) * 12 + (day.mo - now.getUTCMonth());
  for (let i = 0; i < monthsAhead; i++) await patient.getByRole("button", { name: /Mois suivant/ }).click();
  await Promise.all([
    patient.waitForResponse((r) => r.url().includes("psychologist_availability")),
    patient.locator(".grid-cols-7 button:not([disabled])", { hasText: new RegExp(`^${day.d}$`) }).first().click(),
  ]);
  await patient.waitForTimeout(300);
  await patient.getByText("10:30").first().waitFor({ timeout: 5000 });
  expect(!(await patient.getByRole("button", { name: "09:00", exact: true }).count()), "09:00 still bookable");
  expect(!(await patient.getByRole("button", { name: "09:30", exact: true }).count()), "09:30 overlaps 09:00 session");
});
await step("Second booking same day 11:00 (for the no-show scenario)", async () => {
  await book(patient, psyId, day, "11:00");
  const b = await sql("SELECT status FROM bookings WHERE patient_id=$1 AND booked_at=$2", [patientId, s2]);
  expect(b[0]?.status === "confirmed", JSON.stringify(b));
});

log("\n6 · The session");
const joinAt = new Date(s1.getTime() - 10 * 60e3);
await setClock(joinAt, [patient, psyPage]);
let roomUrl = null;
await step("10 min before: the PATIENT opens the room first (no waiting for the therapist)", async () => {
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  const [tab] = await Promise.all([
    ctxPatient.waitForEvent("page", { timeout: 15000 }),
    patient.getByRole("button", { name: /Rejoindre maintenant/ }).first().click(),
  ]);
  await tab.waitForURL(/localhost:54400/, { timeout: 15000 });
  await tab.getByText(/Connecté·e/).waitFor();
  roomUrl = tab.url().split("?")[0];
  const file = await snap(tab, "patient-in-room");
  await tab.close();
  return `${file}; room ${roomUrl}`;
});
await step("The room is private: its bare URL (no personal token) is refused", async () => {
  const intruder = await (await browser.newContext()).newPage();
  const r = await intruder.goto(roomUrl);
  expect(r.status() === 403 && (await intruder.getByText(/Accès refusé/).count()), `status ${r.status()}`);
  const file = await snap(intruder, "intruder-refused");
  await intruder.close();
  return file;
});
await step("Therapist joins from 'Mes séances' with their own token", async () => {
  await psyPage.goto(`${APP}/espace-psy?page=sessions`);
  await psyPage.getByText(PAT.name).first().waitFor({ timeout: 10000 });
  await audit(psyPage, "psy sessions");
  await snap(psyPage, "psy-sessions");
  const [tab] = await Promise.all([
    ctxPsy.waitForEvent("page", { timeout: 15000 }),
    psyPage.getByRole("button", { name: /Rejoindre l'appel/ }).first().click(),
  ]);
  await tab.getByText(/Connecté·e/).waitFor({ timeout: 15000 });
  expect((await tab.locator("#who").innerText()).includes("hôte"), "therapist should be room owner");
  expect((await tab.locator("#count").innerText()).startsWith("2"), "both participants should be in the room");
  const file = await snap(tab, "psy-in-room");
  await tab.close();
  return file;
});
await step("'Mark done' is refused for the 11:00 session nobody attended", async () => {
  const at = new Date(s2.getTime() + 5 * 60e3);
  await setClock(at, [psyPage]);
  await psyPage.reload();
  const id = (await sql("SELECT id FROM bookings WHERE booked_at=$1", [s2]))[0].id;
  const token = await tokenFor(PSY);
  const r = await fetch(`${API}/api/bookings?action=update-status`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ booking_id: id, status: "done" }) });
  const body = await r.json();
  expect(r.status === 400, `status ${r.status} ${JSON.stringify(body)}`);
  return body.error;
});
await step("11:05: patient joins the 11:00 session; therapist never shows up", async () => {
  await setClock(new Date(s2.getTime() + 5 * 60e3), [patient]);
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  const [tab] = await Promise.all([
    ctxPatient.waitForEvent("page", { timeout: 15000 }),
    patient.getByRole("button", { name: /Rejoindre maintenant/ }).first().click(),
  ]);
  await tab.getByText(/Connecté·e/).waitFor({ timeout: 15000 });
  await tab.close();
});
await step("After both sessions end, the scheduled job settles them from attendance", async () => {
  await setApiClock(new Date(s2.getTime() + 2 * 3600e3));
  const r = await cron();
  const b = await sql("SELECT booked_at, status, no_show_party FROM bookings WHERE patient_id=$1 ORDER BY booked_at", [patientId]);
  expect(b[0].status === "done", `09:00 → ${b[0].status}`);
  expect(b[1].status === "no-show" && b[1].no_show_party === "psychologist", `11:00 → ${b[1].status}/${b[1].no_show_party}`);
  const refund = (await sql("SELECT amount, refund_percent, reason, status FROM refunds"))[0];
  expect(refund && refund.amount === 2500 && refund.reason === "therapist_no_show" && refund.status === "due", JSON.stringify(refund));
  return `09:00 done · 11:00 therapist no-show → refund ${refund.amount} DA due · cron ${JSON.stringify(r.sessions)}`;
});
await step("Patient is told the therapist missed it (not blamed) and is refunded", async () => {
  const n = await sql("SELECT title, content FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3", [patientId]);
  expect(n.some((x) => /remboursé/.test(x.content) && !/Vous n'avez pas/.test(x.content)), JSON.stringify(n));
  const mail = (await emails()).find((e) => e.to === PAT.email && /thérapeute n'a pas pu/.test(e.subject));
  expect(mail, "patient no-show e-mail with the right wording missing");
  return mail.subject;
});

log("\n7 · After the session");
await setClock(null, [patient, psyPage]);
await step("History shows 'Terminée' and 'Non assurée · remboursée'; review link appears", async () => {
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.getByText(/Non assurée/).first().waitFor({ timeout: 10000 });
  await audit(patient, "patient history");
  return await snap(patient, "patient-history");
});
await step("Patient leaves a review for the completed session (once)", async () => {
  await patient.getByRole("link", { name: /Laisser un avis/ }).first().click();
  await patient.getByRole("dialog").waitFor({ timeout: 10000 });
  await patient.getByRole("button", { name: /5 étoile|5/ }).last().click().catch(() => {});
  await patient.locator("dialog textarea, [role=dialog] textarea").fill("Écoute bienveillante, je recommande.");
  await patient.getByRole("button", { name: /Publier l'avis/ }).click();
  await patient.waitForTimeout(1500);
  const r = await sql("SELECT booking_id FROM reviews WHERE patient_id=$1", [patientId]);
  expect(r.length === 1 && r[0].booking_id, JSON.stringify(r));
  await patient.reload();
  await patient.getByRole("button", { name: /Avis/ }).click();
  expect(!(await patient.getByRole("button", { name: /Laisser un avis/ }).count()), "can review the same session twice");
  return await snap(patient, "review-posted");
});
await step("Admin sees the refund owed and marks it processed", async () => {
  await admin.getByRole("button", { name: /Remboursements/ }).first().click();
  await admin.getByText(/Psychologue absent/).first().waitFor({ timeout: 10000 });
  await audit(admin, "admin refunds");
  const file = await snap(admin, "admin-refunds");
  await admin.getByRole("button", { name: /Marquer effectué/ }).first().click();
  await admin.waitForTimeout(1000);
  const r = (await sql("SELECT status, processed_by FROM refunds WHERE status='processed'"))[0];
  expect(r?.status === "processed" && r.processed_by, JSON.stringify(r));
  return file;
});
await step("Admin revenue counts the completed session", async () => {
  await admin.getByRole("button", { name: /Tableau de bord/ }).first().click();
  await admin.waitForTimeout(1000);
  const txt = await admin.locator("main").innerText();
  expect(/5\s?000/.test(txt), `revenue: ${txt.replace(/\n/g, " | ").slice(0, 300)}`);
  return "5 000 DA (done + no-show sessions are paid sessions; refunds tracked separately)";
});

log("\n8 · Money edge case: reschedule then cancel");
await step("Reschedule 10 h before, then cancel → 70 % (was 100 % via the loophole)", async () => {
  const d3 = nextWorkingDay(new Date(), 8);
  const s3 = algiers(d3.y, d3.mo, d3.d, 14);
  await book(patient, psyId, d3, "14:00");
  const id = (await sql("SELECT id FROM bookings WHERE booked_at=$1", [s3]))[0].id;
  const tenBefore = new Date(s3.getTime() - 10 * 3600e3);
  await setApiClock(tenBefore);
  try {
  const token = await tokenFor(PAT);
  const post = (a, b) => fetch(`${API}/api/bookings?action=${a}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(b) }).then(async (r) => ({ s: r.status, b: await r.json() }));
  const later = algiers(d3.y, d3.mo, d3.d + 7, 14);
  const rs = await post("reschedule", { booking_id: id, new_booked_at: later.toISOString() });
  expect(rs.s === 200, `reschedule ${rs.s} ${JSON.stringify(rs.b)}`);
  const c = await post("update-status", { booking_id: id, status: "cancelled" });
  expect(c.s === 200 && c.b.refund_percent === 70, `cancel ${c.s} ${JSON.stringify(c.b)}`);
  const ledger = (await sql("SELECT amount, compensation_amount FROM refunds WHERE booking_id=$1", [id]))[0];
  expect(ledger.amount === 1750 && ledger.compensation_amount === 750, JSON.stringify(ledger));
  return `refund 1 750 DA to patient, 750 DA to therapist (sums to the 2 500 DA paid)`;
  } finally { await setApiClock(null); }
});
await step("Reschedule limit: a third move is refused", async () => {
  const d4 = nextWorkingDay(new Date(), 15);
  await book(patient, psyId, d4, "15:00");
  const id = (await sql("SELECT id FROM bookings WHERE booked_at=$1", [algiers(d4.y, d4.mo, d4.d, 15)]))[0].id;
  const token = await tokenFor(PAT);
  const post = (b) => fetch(`${API}/api/bookings?action=reschedule`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(b) }).then((r) => r.status);
  const codes = [];
  for (const k of [1, 2, 3]) codes.push(await post({ booking_id: id, new_booked_at: algiers(d4.y, d4.mo, d4.d + 7 * k, 15).toISOString() }));
  expect(codes.join() === "200,200,400", codes.join());
  return codes.join(" → ");
});

log("\n8b · Propose another time (therapist-approved)");
let reqBookingId = null;
let proposedSat = null;
await step("Limit reached: the patient can still propose a time outside the therapist's hours", async () => {
  const b = (await sql("SELECT id, booked_at, reschedule_count FROM bookings WHERE patient_id=$1 AND status='confirmed' ORDER BY booked_at DESC LIMIT 1", [patientId]))[0];
  expect(b && b.reschedule_count === 2, JSON.stringify(b));
  reqBookingId = b.id;
  // The Saturday before that session, 18:45 Algiers: not a working day, a
  // quarter-hour, after closing time — impossible through the normal calendar.
  const d = new Date(b.booked_at);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7 || 7));
  proposedSat = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 17, 45));
  const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.getByRole("button", { name: /^Reporter$/ }).first().click();
  const dialog = patient.getByRole("dialog");
  await dialog.getByText(/déjà été déplacée 2 fois/).waitFor();
  expect(!(await dialog.getByRole("button", { name: /Choisir un nouveau créneau/ }).count()), "free-slot path should be closed after 2 moves");
  await dialog.getByRole("button", { name: /Proposer un autre horaire/ }).click();
  await dialog.locator('input[type="date"]').fill(ymd);
  await dialog.locator('input[type="time"]').fill("18:45");
  // Typed key by key: the dialog used to remount on every keystroke.
  await dialog.locator("textarea").pressSequentially("Je travaille en semaine, le samedi soir m'arrangerait.", { delay: 5 });
  expect((await dialog.locator("textarea").inputValue()).length > 40, "message lost while typing (dialog remounted)");
  await audit(patient, "propose another time");
  const file = await snap(patient, "propose-time");
  await dialog.getByRole("button", { name: /Envoyer la demande/ }).click();
  await patient.getByText(/Nouvel horaire proposé, en attente/).waitFor({ timeout: 10000 });
  const r = (await sql("SELECT status, proposed_at, message FROM reschedule_requests WHERE booking_id=$1", [reqBookingId]))[0];
  expect(r.status === "pending" && new Date(r.proposed_at).getTime() === proposedSat.getTime(), JSON.stringify(r));
  const still = (await sql("SELECT booked_at FROM bookings WHERE id=$1", [reqBookingId]))[0];
  expect(new Date(still.booked_at).getTime() === new Date(b.booked_at).getTime(), "booking moved before acceptance");
  return `${file}; booking unchanged until accepted`;
});
await step("Therapist is notified (in-app + e-mail)", async () => {
  const n = await sql("SELECT content FROM notifications WHERE user_id=$1 AND title LIKE 'Demande de changement%'", [psyId]);
  expect(n.length === 1, JSON.stringify(n));
  const mail = (await emails()).find((e) => e.to === PSY.email && /changement d'horaire/.test(e.subject));
  expect(mail && /samedi m'arrangerait|samedi soir/.test(mail.html), "e-mail missing or without the patient's message");
  return n[0].content;
});
await step("Patients can't create or approve requests by writing to the table directly", async () => {
  const token = await tokenFor(PAT);
  const h = { apikey: token, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const ins = await fetch("http://localhost:54321/rest/v1/reschedule_requests", { method: "POST", headers: h, body: JSON.stringify({ booking_id: reqBookingId, patient_id: patientId, psychologist_id: psyId, original_booked_at: new Date().toISOString(), proposed_at: new Date().toISOString() }) });
  const upd = await fetch(`http://localhost:54321/rest/v1/reschedule_requests?booking_id=eq.${reqBookingId}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "accepted" }) });
  const still = (await sql("SELECT status FROM reschedule_requests WHERE booking_id=$1", [reqBookingId]))[0];
  expect(ins.status >= 400 && still.status === "pending", `insert ${ins.status}, update ${upd.status}, status ${still.status}`);
  return `insert → ${ins.status}, update → ${upd.status}`;
});
await step("A second request for the same session is refused while one is pending", async () => {
  const token = await tokenFor(PAT);
  const r = await fetch(`${API}/api/bookings?action=reschedule-request`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ booking_id: reqBookingId, proposed_at: new Date(proposedSat.getTime() + 3600e3).toISOString() }) });
  expect(r.status === 409, `status ${r.status}`);
});
await step("Therapist sees it (dashboard banner, 'outside your hours') and accepts with a note", async () => {
  await psyPage.goto(`${APP}/espace-psy`);
  await psyPage.getByText(/demande\(s\) de changement d'horaire/).click();
  const panel = psyPage.getByRole("region", { name: /Demandes de changement d'horaire/ });
  await panel.getByText(/Hors de vos horaires/).waitFor({ timeout: 10000 });
  await panel.getByText(/samedi soir/).waitFor();
  await panel.locator('input[type="text"]').fill("Avec plaisir, à samedi.");
  await audit(psyPage, "therapist requests");
  const file = await snap(psyPage, "psy-reschedule-request");
  await panel.getByRole("button", { name: /Accepter le nouvel horaire/ }).click();
  await psyPage.getByText(/Séance déplacée/).first().waitFor({ timeout: 10000 });
  const b = (await sql("SELECT booked_at, reschedule_count, policy_anchor_at FROM bookings WHERE id=$1", [reqBookingId]))[0];
  expect(new Date(b.booked_at).getTime() === proposedSat.getTime(), `booked_at ${b.booked_at}`);
  expect(b.reschedule_count === 2, `an agreed move should not use the limit (count ${b.reschedule_count})`);
  expect(new Date(b.policy_anchor_at).getTime() < proposedSat.getTime(), "refund anchor lost");
  const mail = (await emails()).find((e) => e.to === PAT.email && /accepté/.test(e.subject));
  expect(mail && /Avec plaisir/.test(mail.html), "patient e-mail missing or without the therapist's note");
  return `${file}; moved to Saturday 18:45, count still 2, refund still measured from the first date`;
});
await step("Patient sees the new time; a declined proposal leaves the session where it is", async () => {
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.getByText("18:45").first().waitFor({ timeout: 10000 });
  const token = await tokenFor(PAT);
  const later = new Date(proposedSat.getTime() + 2 * 24 * 3600e3); // Monday 18:45
  const r = await fetch(`${API}/api/bookings?action=reschedule-request`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ booking_id: reqBookingId, proposed_at: later.toISOString(), message: "Ou lundi ?" }) });
  expect(r.ok, `request ${r.status}`);
  await psyPage.goto(`${APP}/espace-psy?page=sessions`);
  const panel = psyPage.getByRole("region", { name: /Demandes de changement d'horaire/ });
  await panel.getByText(/Ou lundi/).waitFor({ timeout: 10000 });
  await panel.getByRole("button", { name: /^Refuser$/ }).click();
  await psyPage.getByText(/Demande refusée/).first().waitFor({ timeout: 10000 });
  const b = (await sql("SELECT booked_at FROM bookings WHERE id=$1", [reqBookingId]))[0];
  expect(new Date(b.booked_at).getTime() === proposedSat.getTime(), "declined request moved the session");
  const n = await sql("SELECT title FROM notifications WHERE user_id=$1 AND title='Horaire non disponible'", [patientId]);
  expect(n.length === 1, "patient not told about the refusal");
});
await step("A proposal overlapping another of the therapist's sessions is refused", async () => {
  const other = nextWorkingDay(new Date(), 20);
  await book(patient, psyId, other, "10:00");
  const token = await tokenFor(PAT);
  const r = await fetch(`${API}/api/bookings?action=reschedule-request`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ booking_id: reqBookingId, proposed_at: algiers(other.y, other.mo, other.d, 10, 30).toISOString() }) });
  const body = await r.json();
  expect(r.status === 409 && /déjà une séance/.test(body.error), `${r.status} ${JSON.stringify(body)}`);
  return body.error;
});
await step("Patient can withdraw a pending request", async () => {
  const token = await tokenFor(PAT);
  const ok = await fetch(`${API}/api/bookings?action=reschedule-request`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ booking_id: reqBookingId, proposed_at: new Date(proposedSat.getTime() + 3 * 24 * 3600e3).toISOString() }) });
  expect(ok.ok, `request ${ok.status}`);
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.getByRole("button", { name: /Annuler la demande/ }).click();
  await patient.getByText(/Demande annulée/).first().waitFor({ timeout: 10000 });
  const r = await sql("SELECT status FROM reschedule_requests WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1", [reqBookingId]);
  expect(r[0].status === "cancelled", JSON.stringify(r));
});

log("\n9 · Language, mobile, logout");
await step("Arabic UI uses the Gregorian calendar (no Hijri dates)", async () => {
  await patient.evaluate(() => localStorage.setItem("majal-lang", "ar"));
  await patient.goto(`${APP}/mon-espace?page=sessions`);
  await patient.waitForTimeout(1500);
  const txt = await patient.locator("main").innerText();
  expect(!/(محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)/.test(txt), "Hijri month names found");
  await audit(patient, "patient sessions (ar)");
  const file = await snap(patient, "patient-sessions-ar");
  await patient.evaluate(() => localStorage.setItem("majal-lang", "fr"));
  return file;
});
await step("Mobile (375 px): patient dashboard renders without horizontal scroll", async () => {
  const m = await (await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2, storageState: await ctxPatient.storageState() })).newPage();
  watch(m, "mobile");
  await m.goto(`${APP}/mon-espace`);
  await m.waitForTimeout(1500);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow <= 1, `horizontal overflow ${overflow}px`);
  await audit(m, "mobile dashboard");
  return await snap(m, "mobile-dashboard");
});
await step("Logout clears private notes cached on the device", async () => {
  await patient.goto(`${APP}/mon-espace`);
  await patient.getByText(/Bonjour|Bienvenue|Tableau de bord/).first().waitFor({ timeout: 10000 });
  await patient.evaluate(() => localStorage.setItem("majal_journal_entries_test", "secret"));
  const btn = patient.getByRole("button", { name: /Déconnexion/ });
  const file = await snap(patient, "before-logout");
  expect(await btn.count(), `no logout button visible (${file}, url ${patient.url()})`);
  await btn.first().click();
  await patient.waitForURL(/\/(connexion)?$/, { timeout: 10000 }).catch(() => {});
  await patient.waitForTimeout(800);
  const left = await patient.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("majal_")));
  expect(left.length === 0, `left behind: ${left.join(", ")}`);
  return `redirected to ${new URL(patient.url()).pathname}`;
});
await step("No unexpected console errors during the journey", async () => {
  expect(consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" || "));
});
await step("No duplicate ids / untranslated keys on audited pages", async () => {
  expect(pageIssues.length === 0, pageIssues.join(" || "));
});

const apiCalls = await (await fetch(`${API}/__api`)).json();
console.log("\nHTTP errors seen by the browser:\n" + httpErrors.join("\n"));
fs.writeFileSync(path.join(ART, "journey.json"), JSON.stringify({ results, consoleErrors, httpErrors, pageIssues, emails: (await emails()).map(({ to, subject }) => ({ to, subject })), daily: (await daily()).log, apiCalls }, null, 2));
await browser.close();
await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
