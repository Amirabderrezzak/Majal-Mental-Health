// Live test of "propose another time" (therapist-approved reschedule) on the real
// site, between two QA accounts. Setup/cleanup is done by the caller (SQL via the
// Supabase Management API); this script drives the real UI and API.
//
//   BASE SUPABASE_URL ANON QA_PW QA_PATIENT QA_PSY node e2e/live-reschedule.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(here, "artifacts-live-reschedule");
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });
const { BASE, SUPABASE_URL, ANON, QA_PW, QA_PATIENT, QA_PSY } = process.env;

const results = [];
const failPages = {};
let shot = 0;
const expect = (c, m) => { if (!c) throw new Error(m); };
async function snap(page, label) {
  await page.waitForTimeout(700);
  const f = `${String(++shot).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: path.join(ART, f) });
  return f;
}
async function step(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true, detail: d ?? "" });
    console.log(`  ✓ ${name}${d ? ` — ${d}` : ""}`);
  } catch (e) {
    for (const [l, pg] of Object.entries(failPages)) if (pg && !pg.isClosed()) await pg.screenshot({ path: path.join(ART, `FAIL-${++shot}-${l}.png`) }).catch(() => {});
    results.push({ name, ok: false, detail: String(e?.message || e).split("\n")[0] });
    console.log(`  ✗ ${name} — ${String(e?.message || e).split("\n")[0]}`);
  }
}
const login = async (email) => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: QA_PW }) });
  const j = await r.json();
  expect(j.access_token, `login failed for ${email}`);
  return j;
};
const rest = async (p, token, opts = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { method: opts.method || "GET", headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const api = async (action, token, body) => {
  const r = await fetch(`${BASE}/api/bookings?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const ymdAlgiers = (d) => new Date(d.getTime() + 3600e3).toISOString().slice(0, 10);
// The first `dow` (0=Sun … 6=Sat) strictly after `d`, at hh:mm Algiers.
const nextDow = (d, dow, hh, mm) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  do { x.setUTCDate(x.getUTCDate() + 1); } while (x.getUTCDay() !== dow);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), hh - 1, mm));
};

const pat = await login(QA_PATIENT);
const psy = await login(QA_PSY);
const bookings = (await rest("bookings?select=id,booked_at,reschedule_count,policy_anchor_at&order=booked_at", pat.access_token)).body;
expect(bookings.length === 2, `expected the 2 QA bookings, got ${JSON.stringify(bookings)}`);
const [main, other] = bookings;
const original = new Date(main.booked_at);
const saturday = nextDow(original, 6, 19, 15); // Saturday 19:15 Algiers — outside default hours/days, quarter-hour
console.log(`\nSession ${main.id} at ${original.toISOString()} → proposing ${saturday.toISOString()} (Sat 19:15 Algiers)`);

const browser = await chromium.launch();
const ctxP = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
const ctxT = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
const pp = await ctxP.newPage(); failPages.patient = pp;
const tp = await ctxT.newPage(); failPages.therapist = tp;
const consoleErrors = [];
for (const [p, who] of [[pp, "patient"], [tp, "therapist"]]) {
  p.on("pageerror", (e) => consoleErrors.push(`[${who}] ${e.message.slice(0, 160)}`));
  p.on("console", (m) => { if (m.type() === "error" && !/vercel-scripts|_vercel\/insights/.test(m.text())) consoleErrors.push(`[${who}] ${m.text().slice(0, 160)}`); });
}
async function uiLogin(page, email, urlRe) {
  await page.goto(`${BASE}/connexion`);
  await page.fill("#connexion-f1", email);
  await page.fill("#connexion-f2", QA_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(urlRe, { timeout: 20000 });
}

console.log("\nPatient proposes another time");
await step("Patient logs in and opens the reschedule dialog on the confirmed session", async () => {
  await uiLogin(pp, QA_PATIENT, /\/mon-espace/);
  await pp.goto(`${BASE}/mon-espace?page=sessions`, { waitUntil: "networkidle" });
  await pp.getByRole("button", { name: /^Reporter$/ }).first().click();
  const d = pp.getByRole("dialog");
  await d.getByRole("button", { name: /Choisir un nouveau créneau/ }).waitFor();
  await d.getByRole("button", { name: /Proposer un autre horaire/ }).waitFor();
  return "both options offered (free slot + propose another time)";
});
await step("Proposes Saturday 19:15 with a message (typed key by key)", async () => {
  const d = pp.getByRole("dialog");
  await d.getByRole("button", { name: /Proposer un autre horaire/ }).click();
  await d.locator('input[type="date"]').fill(ymdAlgiers(saturday));
  await d.locator('input[type="time"]').fill("19:15");
  await d.locator("textarea").pressSequentially("Test QA : le samedi soir m'arrangerait.", { delay: 5 });
  expect((await d.locator("textarea").inputValue()).length > 30, "message lost while typing");
  const f = await snap(pp, "patient-propose");
  await d.getByRole("button", { name: /Envoyer la demande/ }).click();
  await pp.getByText(/Nouvel horaire proposé, en attente/).waitFor({ timeout: 15000 });
  await snap(pp, "patient-pending");
  const r = (await rest(`reschedule_requests?select=status,proposed_at,message&booking_id=eq.${main.id}`, pat.access_token)).body;
  expect(r.length === 1 && r[0].status === "pending" && new Date(r[0].proposed_at).getTime() === saturday.getTime(), JSON.stringify(r));
  const b = (await rest(`bookings?select=booked_at&id=eq.${main.id}`, pat.access_token)).body[0];
  expect(new Date(b.booked_at).getTime() === original.getTime(), "session moved before the therapist accepted");
  return `${f}; stored pending, session unchanged`;
});
await step("A second request for the same session is refused while one is pending", async () => {
  const r = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: new Date(saturday.getTime() + 3600e3).toISOString() });
  expect(r.status === 409, `${r.status} ${JSON.stringify(r.body)}`);
  return r.body.error;
});
await step("The patient cannot write or approve requests directly in the database", async () => {
  const ins = await rest("reschedule_requests", pat.access_token, { method: "POST", body: { booking_id: main.id, patient_id: pat.user.id, psychologist_id: psy.user.id, original_booked_at: main.booked_at, proposed_at: saturday.toISOString() } });
  const upd = await rest(`reschedule_requests?booking_id=eq.${main.id}`, pat.access_token, { method: "PATCH", body: { status: "accepted" } });
  const r = (await rest(`reschedule_requests?select=status&booking_id=eq.${main.id}`, pat.access_token)).body;
  expect(ins.status >= 400 && r[0].status === "pending", `insert ${ins.status}, update ${upd.status}, status ${r[0].status}`);
  return `insert → ${ins.status}, update → ${upd.status}`;
});
await step("The therapist cannot accept it by writing to the table either", async () => {
  await rest(`reschedule_requests?booking_id=eq.${main.id}`, psy.access_token, { method: "PATCH", body: { status: "accepted" } });
  const r = (await rest(`reschedule_requests?select=status&booking_id=eq.${main.id}`, psy.access_token)).body;
  expect(r[0].status === "pending", JSON.stringify(r));
});

console.log("\nTherapist answers");
await step("Therapist is notified in-app; dashboard banner leads to the request", async () => {
  const n = (await rest("notifications?select=title,content&title=like.Demande de changement*", psy.access_token)).body;
  expect(n.length === 1 && /samedi/.test(n[0].content), JSON.stringify(n));
  await uiLogin(tp, QA_PSY, /\/espace-psy/);
  await tp.waitForLoadState("networkidle");
  await tp.getByText(/demande\(s\) de changement d'horaire/).click();
  const panel = tp.getByRole("region", { name: /Demandes de changement d'horaire/ });
  await panel.getByText(/Hors de vos horaires/).waitFor({ timeout: 15000 });
  await panel.getByText(/samedi soir/).waitFor();
  return n[0].content;
});
await step("Therapist accepts with a note → session moves to Saturday 19:15", async () => {
  const panel = tp.getByRole("region", { name: /Demandes de changement d'horaire/ });
  await panel.locator('input[type="text"]').fill("Test QA : d'accord pour samedi.");
  const f = await snap(tp, "therapist-request");
  await panel.getByRole("button", { name: /Accepter le nouvel horaire/ }).click();
  await tp.getByText(/Séance déplacée/).first().waitFor({ timeout: 15000 });
  const b = (await rest(`bookings?select=booked_at,reschedule_count,policy_anchor_at&id=eq.${main.id}`, pat.access_token)).body[0];
  expect(new Date(b.booked_at).getTime() === saturday.getTime(), `booked_at ${b.booked_at}`);
  expect(b.reschedule_count === 0, `agreed move counted toward the limit (${b.reschedule_count})`);
  expect(new Date(b.policy_anchor_at).getTime() === original.getTime(), `refund anchor ${b.policy_anchor_at}`);
  const r = (await rest(`reschedule_requests?select=status,response_note&booking_id=eq.${main.id}`, pat.access_token)).body[0];
  expect(r.status === "accepted" && /samedi/.test(r.response_note), JSON.stringify(r));
  return `${f}; moved, move limit untouched, refund still measured from the original date`;
});
await step("Patient is notified and sees the new time 19:15", async () => {
  const n = (await rest("notifications?select=content&title=eq.Nouvel horaire accepté", pat.access_token)).body;
  expect(n.length === 1 && /d'accord pour samedi/.test(n[0].content), JSON.stringify(n));
  await pp.goto(`${BASE}/mon-espace?page=sessions`, { waitUntil: "networkidle" });
  await pp.getByText("19:15").first().waitFor({ timeout: 15000 });
  return await snap(pp, "patient-moved");
});

console.log("\nDecline, overlap, withdraw");
await step("A second proposal is declined → session stays on Saturday, patient told why", async () => {
  const monday = nextDow(saturday, 1, 20, 0);
  const r = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: monday.toISOString(), message: "Test QA : ou lundi soir ?" });
  expect(r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);
  await tp.goto(`${BASE}/espace-psy?page=sessions`, { waitUntil: "networkidle" });
  const panel = tp.getByRole("region", { name: /Demandes de changement d'horaire/ });
  await panel.getByText(/lundi soir/).waitFor({ timeout: 15000 });
  await panel.locator('input[type="text"]').fill("Test QA : lundi je ne peux pas.");
  await panel.getByRole("button", { name: /^Refuser$/ }).click();
  await tp.getByText(/Demande refusée/).first().waitFor({ timeout: 15000 });
  const b = (await rest(`bookings?select=booked_at&id=eq.${main.id}`, pat.access_token)).body[0];
  expect(new Date(b.booked_at).getTime() === saturday.getTime(), "declined request moved the session");
  const n = (await rest("notifications?select=content&title=eq.Horaire non disponible", pat.access_token)).body;
  expect(n.length === 1 && /lundi je ne peux pas/.test(n[0].content), JSON.stringify(n));
  return n[0].content;
});
await step("A proposal overlapping the therapist's other session is refused", async () => {
  const overlap = new Date(new Date(other.booked_at).getTime() + 30 * 60e3);
  const r = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: overlap.toISOString() });
  expect(r.status === 409 && /déjà une séance/.test(r.body.error), `${r.status} ${JSON.stringify(r.body)}`);
  return r.body.error;
});
await step("Proposals less than 2 h ahead or off the 15-minute grid are refused", async () => {
  const soon = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: new Date(Date.now() + 30 * 60e3).toISOString() });
  const odd = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: new Date(saturday.getTime() + 2 * 864e5 + 7 * 60e3).toISOString() });
  expect(soon.status === 400 && odd.status === 400, `soon ${soon.status}, 7-min offset ${odd.status}`);
  return `${soon.body.error} / ${odd.body.error}`;
});
await step("Patient withdraws a pending request from the session card", async () => {
  const r = await api("reschedule-request", pat.access_token, { booking_id: main.id, proposed_at: nextDow(saturday, 2, 18, 30).toISOString() });
  expect(r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);
  await pp.goto(`${BASE}/mon-espace?page=sessions`, { waitUntil: "networkidle" });
  await pp.getByRole("button", { name: /Annuler la demande/ }).click();
  await pp.getByText(/Demande annulée/).first().waitFor({ timeout: 15000 });
  const last = (await rest(`reschedule_requests?select=status&booking_id=eq.${main.id}&order=created_at.desc&limit=1`, pat.access_token)).body[0];
  expect(last.status === "cancelled", JSON.stringify(last));
  const t = await api("reschedule-respond", psy.access_token, { request_id: "00000000-0000-0000-0000-000000000000", accept: true });
  expect(t.status === 404, `respond to unknown request → ${t.status}`);
});
console.log("\nTherapist proposes another time");
await step("Therapist proposes another time on the other paid session (UI)", async () => {
  const dateFr = new Date(other.booked_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" });
  await tp.goto(`${BASE}/espace-psy?page=sessions`, { waitUntil: "networkidle" });
  const row = tp.locator("div.flex.items-center.gap-4", { hasText: dateFr }).first();
  await row.getByRole("button", { name: /Proposer un autre horaire/ }).click();
  const d = tp.getByRole("dialog");
  globalThis.__target = new Date(new Date(other.booked_at).getTime() + 86400e3 + 30 * 60e3); // next day, +30 min (14:30 → 15:00+1d? see below)
  const nextDay = ymdAlgiers(new Date(new Date(other.booked_at).getTime() + 86400e3));
  globalThis.__target = new Date(`${nextDay}T18:30:00Z`); // 19:30 Algiers the next day
  await d.locator('input[type="date"]').fill(nextDay);
  await d.locator('input[type="time"]').fill("19:30");
  await d.locator("textarea").pressSequentially("Test QA : je ne pourrai pas ce jour-là, le lendemain 19h30 ?", { delay: 3 });
  const f = await snap(tp, "psy-propose");
  await d.getByRole("button", { name: /Envoyer la proposition/ }).click();
  await tp.getByText(/Proposition envoyée/).first().waitFor({ timeout: 15000 });
  await tp.getByText(/Proposé :/).first().waitFor({ timeout: 10000 });
  const r = (await rest(`reschedule_requests?select=initiated_by,status&booking_id=eq.${other.id}&status=eq.pending`, pat.access_token)).body;
  expect(r.length === 1 && r[0].initiated_by === "psychologist", JSON.stringify(r));
  return f;
});
await step("Patient is notified (nothing to repay), sees the banner and accepts in one click", async () => {
  const n = (await rest("notifications?select=content&title=eq.Votre psychologue propose un autre horaire", pat.access_token)).body;
  expect(n.length === 1 && /rien à repayer/.test(n[0].content), JSON.stringify(n));
  const paysBefore = (await rest("payments?select=id", pat.access_token)).body.length;
  await pp.goto(`${BASE}/mon-espace`, { waitUntil: "networkidle" });
  await pp.getByText(/vous propose un nouvel horaire/).click();
  const card = pp.getByRole("group", { name: /propose un autre horaire/ });
  await card.getByText(/rien à repayer/).waitFor({ timeout: 10000 });
  const f = await snap(pp, "patient-proposal");
  await card.getByRole("button", { name: /Accepter le nouvel horaire/ }).click();
  await pp.getByText(/votre séance est déplacée/).first().waitFor({ timeout: 15000 });
  const b = (await rest(`bookings?select=booked_at,policy_anchor_at&id=eq.${other.id}`, pat.access_token)).body[0];
  expect(new Date(b.booked_at).getTime() === globalThis.__target.getTime(), `booked_at ${b.booked_at}`);
  expect(b.policy_anchor_at == null, "refund anchor set against the patient");
  expect((await rest("payments?select=id", pat.access_token)).body.length === paysBefore, "a payment was created");
  const tn = (await rest("notifications?select=title&title=eq.Nouvel horaire accepté par le patient", psy.access_token)).body;
  expect(tn.length === 1, "therapist not told");
  return `${f}; moved to 19:30 the next day, no new payment, therapist notified`;
});
await step("Patient declines a second proposal → session stays, therapist told to propose again or cancel", async () => {
  const cur = new Date((await rest(`bookings?select=booked_at&id=eq.${other.id}`, pat.access_token)).body[0].booked_at);
  const r = await api("reschedule-request", psy.access_token, { booking_id: other.id, proposed_at: new Date(cur.getTime() + 2 * 86400e3).toISOString() });
  expect(r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);
  await pp.goto(`${BASE}/mon-espace?page=sessions`, { waitUntil: "networkidle" });
  await pp.getByRole("group", { name: /propose un autre horaire/ }).getByRole("button", { name: /^Refuser$/ }).click();
  await pp.getByText(/Refus envoyé/).first().waitFor({ timeout: 15000 });
  const after = new Date((await rest(`bookings?select=booked_at&id=eq.${other.id}`, pat.access_token)).body[0].booked_at);
  expect(after.getTime() === cur.getTime(), "declined proposal moved the session");
  const tn = (await rest("notifications?select=content&title=eq.Horaire proposé refusé", psy.access_token)).body;
  expect(tn.length === 1 && /remboursé/.test(tn[0].content), JSON.stringify(tn));
});
await step("The therapist can't accept their own proposal; the patient can't withdraw it", async () => {
  const cur = new Date((await rest(`bookings?select=booked_at&id=eq.${other.id}`, pat.access_token)).body[0].booked_at);
  const r = await api("reschedule-request", psy.access_token, { booking_id: other.id, proposed_at: new Date(cur.getTime() + 3 * 86400e3).toISOString() });
  const id = r.body?.request?.id;
  const selfAccept = await api("reschedule-respond", psy.access_token, { request_id: id, accept: true });
  const patWithdraw = await api("reschedule-cancel", pat.access_token, { request_id: id });
  const psyWithdraw = await api("reschedule-cancel", psy.access_token, { request_id: id });
  expect(selfAccept.status === 403 && patWithdraw.status === 409 && psyWithdraw.status === 200, `${selfAccept.status}/${patWithdraw.status}/${psyWithdraw.status}`);
});
await step("No console errors", async () => { expect(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" || ")); });

fs.writeFileSync(path.join(ART, "results.json"), JSON.stringify({ at: new Date().toISOString(), results, consoleErrors }, null, 2));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
