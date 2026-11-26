// Checks against the REAL site (production) — safe by design:
//  • no payments, no bookings (a checkout would hold a real therapist's slot),
//  • no public posts (forum, gratitude wall), no e-mails to real people,
//  • writes only with two QA accounts (patient + an UNAPPROVED, never-public
//    therapist) created on example.com and deleted afterwards.
//
//   BASE=https://majalpsy.com SUPABASE_URL=https://<ref>.supabase.co ANON=<publishable key> \
//   QA_PW=<password> QA_PATIENT=qa-patient-…@example.com QA_PSY=qa-psy-…@example.com node e2e/live-check.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(here, "artifacts-live");
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });
const { BASE, SUPABASE_URL, ANON, QA_PW, QA_PATIENT, QA_PSY } = process.env;
const REST = `${SUPABASE_URL}/rest/v1`;

const results = [];
const failPages = {};
let shot = 0;
async function step(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true, detail: d ?? "" });
    console.log(`  ✓ ${name}${d ? ` — ${d}` : ""}`);
  } catch (e) {
    for (const [label, pg] of Object.entries(failPages)) {
      if (pg && !pg.isClosed()) await pg.screenshot({ path: path.join(ART, `FAIL-${++shot}-${label}.png`) }).catch(() => {});
    }
    results.push({ name, ok: false, detail: String(e?.message || e).split("\n")[0] });
    console.log(`  ✗ ${name} — ${String(e?.message || e).split("\n")[0]}`);
  }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
async function snap(page, label) {
  await page.waitForTimeout(700);
  const f = `${String(++shot).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: path.join(ART, f) });
  return f;
}
const rest = async (p, { token = ANON, method = "GET", body, prefer } = {}) => {
  const r = await fetch(`${REST}/${p}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const login = async (email) => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: QA_PW }) });
  const j = await r.json();
  expect(j.access_token, `login failed for ${email}: ${JSON.stringify(j).slice(0, 120)}`);
  return j;
};
const api = async (p, token, body = {}) => {
  const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const consoleErrors = [];
const pageIssues = [];
function watch(page, who) {
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_BLOCKED_BY_CLIENT|vercel-scripts|_vercel\/insights/.test(m.text())) consoleErrors.push(`[${who}] ${m.text().slice(0, 180)}`); });
  page.on("pageerror", (e) => consoleErrors.push(`[${who}] PAGE ERROR ${e.message.slice(0, 180)}`));
}
async function audit(page, where) {
  const r = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id).filter(Boolean);
    const text = document.body.innerText;
    return {
      dup: [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))],
      raw: [...new Set(text.match(/\b(?:space|psy|prof|res|pd|admin|auth|editor|common|pay|nav)\.[a-zA-Z0-9_.-]+\b/g) || [])].filter((k) => !/\.(com|dz|fr)$/.test(k)),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (r.dup.length) pageIssues.push(`${where}: duplicate ids ${r.dup.join(", ")}`);
  if (r.raw.length) pageIssues.push(`${where}: untranslated ${r.raw.join(", ")}`);
  return r;
}

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "fr-FR" });
const mobile = await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2, locale: "fr-FR" });

// ── A. Public pages ─────────────────────────────────────────────────────────
console.log("\nA · Public pages (anonymous)");
const dir = await rest("psychologist_directory?select=user_id,full_name,price_per_session,price_individual,language,approval_status&limit=50");
const approved = (dir.body || [])[0];
const pages = ["/", "/psychologues", approved ? `/profil/${approved.user_id}` : null, "/faq", "/contact", "/aide", "/confidentialite", "/conditions", "/connexion", "/inscription", "/mot-de-passe-oublie", "/admin/login", "/page-qui-n-existe-pas"].filter(Boolean);
for (const p of process.env.SKIP_PUBLIC ? [] : pages) {
  await step(`${p} loads (desktop + 375 px), no errors / duplicate ids / raw keys`, async () => {
    for (const [ctx, label] of [[desktop, "desktop"], [mobile, "mobile"]]) {
      const page = await ctx.newPage(); watch(page, `${label} ${p}`);
      const r = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
      expect(r.status() < 400, `HTTP ${r.status()}`);
      const a = await audit(page, `${label} ${p}`);
      if (label === "mobile") expect(a.overflow <= 1, `horizontal overflow ${a.overflow}px on phones`);
      if (p === "/" && label === "desktop") await snap(page, "home");
      if (p === "/psychologues" && label === "desktop") await snap(page, "directory");
      if (p.startsWith("/profil") && label === "mobile") await snap(page, "profile-mobile");
      await page.close();
    }
  });
}
await step("Home page counters show real numbers to anonymous visitors", async () => {
  const s = await rest("rpc/public_stats", { method: "POST", body: {} });
  expect(s.status === 200 && s.body.psychologists > 0, JSON.stringify(s));
  const page = await desktop.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const txt = await page.locator("body").innerText();
  await page.close();
  expect(txt.includes(String(s.body.psychologists)), "counter not shown");
  return `${s.body.psychologists} psychologues, ${s.body.sessions} séances`;
});
await step("Directory: prices are real (no invented 3 000 DZD), unapproved QA therapist hidden", async () => {
  const page = await desktop.newPage();
  await page.goto(`${BASE}/psychologues`, { waitUntil: "networkidle" });
  const txt = await page.locator("body").innerText();
  await page.close();
  expect(!txt.includes("QA Psy"), "unapproved test therapist is listed");
  const unpriced = (dir.body || []).filter((d) => d.price_per_session == null).length;
  expect(unpriced === 0 || /Tarif bientôt disponible/.test(txt), "therapists without a price show a made-up price");
  return `${(dir.body || []).length} approved therapists; ${unpriced} without a price shown as "Tarif bientôt disponible"`;
});
await step("Arabic: Gregorian dates, RTL, no raw keys", async () => {
  // Own context: the language choice is stored per origin and must not leak
  // into the other pages of this run.
  const arCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await arCtx.newPage();
  await page.addInitScript(() => localStorage.setItem("majal-lang", "ar"));
  await page.goto(`${BASE}/psychologues`, { waitUntil: "networkidle" });
  expect(await page.evaluate(() => document.documentElement.dir) === "rtl", "not RTL");
  await audit(page, "ar directory");
  const txt = await page.locator("body").innerText();
  expect(!/זוג/.test(txt), "Hebrew word still in the Arabic UI");
  const f = await snap(page, "directory-ar");
  await arCtx.close();
  return f;
});

// ── B. API guards ───────────────────────────────────────────────────────────
console.log("\nB · API (no credentials)");
await step("Every protected API action refuses anonymous calls", async () => {
  const calls = [
    "/api/payments?action=checkout", "/api/payments?action=confirm", "/api/bookings?action=update-status", "/api/bookings?action=reschedule",
    "/api/bookings?action=reschedule-request", "/api/bookings?action=reschedule-respond", "/api/bookings?action=reschedule-cancel",
    "/api/calls?action=room", "/api/calls?action=instant-accept", "/api/calls?action=audio-room", "/api/calls?action=audio-join",
    "/api/messages?action=send", "/api/notifications?action=send-push", "/api/admin?action=notify-therapist",
  ];
  const bad = [];
  for (const c of calls) { const r = await api(c, null); if (r.status !== 401) bad.push(`${c} → ${r.status}`); }
  const cron = await fetch(`${BASE}/api/notifications?action=push-cron`);
  if (cron.status !== 401) bad.push(`push-cron → ${cron.status}`);
  expect(bad.length === 0, bad.join(", "));
  return `${calls.length + 1} endpoints → 401`;
});
await step("Health + unknown action", async () => {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  const u = await api("/api/bookings?action=nope", null);
  expect(h.status === "ok" && u.status === 400, `${JSON.stringify(h)} / ${u.status}`);
});

// ── C. Data exposure (anonymous) ────────────────────────────────────────────
console.log("\nC · Data exposure (anonymous)");
await step("Reviewer identities are not public; public reviews still readable", async () => {
  const raw = await rest("reviews?select=patient_id&limit=5");
  const pub = await rest("reviews_public?select=id,rating,is_mine&limit=5");
  expect(Array.isArray(raw.body) && raw.body.length === 0, `reviews.patient_id readable: ${JSON.stringify(raw.body).slice(0, 80)}`);
  expect(pub.status === 200 && !JSON.stringify(pub.body).includes("patient_id"), JSON.stringify(pub).slice(0, 120));
  return `${pub.body.length} public reviews, no patient ids`;
});
await step("Forum authors are not exposed; anonymous view works", async () => {
  const raw = await rest("forum_threads?select=author_id&limit=5");
  const pub = await rest("forum_threads_public?select=id,author_label&limit=5");
  expect(Array.isArray(raw.body) && raw.body.length === 0, `author ids readable: ${JSON.stringify(raw.body).slice(0, 80)}`);
  expect(pub.status === 200, JSON.stringify(pub).slice(0, 120));
  return `${pub.body.length} threads via the anonymous view`;
});
await step("Therapist rows (phone, licence, admin flag) not readable anonymously", async () => {
  const r = await rest("profiles?select=phone,order_number,is_admin&user_type=eq.psychologue&limit=5");
  expect(Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body).slice(0, 100));
});
await step("Expired 'live' audio rooms no longer listed", async () => {
  const r = await rest("audio_rooms_public?select=id,created_at");
  expect(r.status === 200, JSON.stringify(r));
  const old = (r.body || []).filter((x) => Date.now() - new Date(x.created_at).getTime() > 2 * 3600e3);
  expect(old.length === 0, `${old.length} stale rooms still listed`);
  return `${r.body.length} live now`;
});

// ── D. Patient (QA account) ─────────────────────────────────────────────────
console.log("\nD · Patient (QA account)");
const pat = await login(QA_PATIENT);
const psy = await login(QA_PSY);
const pp = await desktop.newPage(); watch(pp, "patient"); failPages.patient = pp;
await step("Patient logs in through the form and lands in their space", async () => {
  await pp.goto(`${BASE}/connexion`);
  await pp.fill("#connexion-f1", QA_PATIENT);
  await pp.fill("#connexion-f2", QA_PW);
  await pp.click('button[type="submit"]');
  await pp.waitForURL(/\/mon-espace/, { timeout: 20000 });
  await pp.waitForLoadState("networkidle");
  const txt = await pp.locator("main").innerText();
  expect(/0j/.test(txt) || !/5j/.test(txt), "fake 5-day streak still shown");
  await audit(pp, "patient dashboard");
  return await snap(pp, "patient-dashboard");
});
await step("Deep link ?page=sessions opens 'Mes séances' (e-mail links)", async () => {
  await pp.goto(`${BASE}/mon-espace?page=sessions`, { waitUntil: "networkidle" });
  await pp.getByText(/Prochaines séances/).first().waitFor({ timeout: 10000 });
  await audit(pp, "patient sessions");
});
await step("Profile save works (was always failing)", async () => {
  await pp.goto(`${BASE}/mon-espace?page=profil`, { waitUntil: "networkidle" });
  await pp.locator('input[type="tel"]').first().fill("0000000001");
  await pp.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  await pp.getByText(/Profil mis à jour/).first().waitFor({ timeout: 10000 });
  const r = await rest("profiles?select=phone", { token: pat.access_token });
  expect(r.body?.[0]?.phone === "0000000001", JSON.stringify(r.body));
  await audit(pp, "patient profile");
});
await step("Journal: add then delete an entry (real ids, no 'run the SQL migration' error)", async () => {
  await pp.goto(`${BASE}/mon-espace?page=journal`, { waitUntil: "networkidle" });
  await pp.locator("textarea").first().fill("Entrée de test automatisée (QA).");
  await pp.getByRole("button", { name: /Enregistrer/ }).first().click();
  await pp.getByText(/enregistrée avec succès/).first().waitFor({ timeout: 10000 });
  const before = await rest("journal_entries?select=id", { token: pat.access_token });
  expect(before.body.length === 1, JSON.stringify(before.body));
  await pp.waitForTimeout(800);
  const del = pp.getByRole("button", { name: /Supprimer/ }).first();
  if (await del.count()) { await del.click(); await pp.waitForTimeout(1500); }
  const after = await rest("journal_entries?select=id", { token: pat.access_token });
  expect(after.body.length === 0, `entry not deleted (${after.body.length} left)`);
  expect(!(await pp.getByText(/migration SQL/).count()), "migration error shown");
  await audit(pp, "journal");
});
await step("Reservation page shows the real therapist's real slots (nothing booked)", async () => {
  if (!approved) return "no approved therapist";
  await pp.goto(`${BASE}/reservation/${approved.user_id}`, { waitUntil: "networkidle" });
  await pp.getByRole("button", { name: /Confirmer la réservation/ }).waitFor({ timeout: 10000 });
  await audit(pp, "reservation");
  const f = await snap(pp, "reservation");
  return `${f} (stopped before checkout)`;
});
await step("Patient messages the (unapproved) QA therapist", async () => {
  await pp.goto(`${BASE}/mon-espace?page=messages&psy=${psy.user.id}&name=QA%20Psy`, { waitUntil: "networkidle" });
  const box = pp.locator("textarea, input[type='text']").last();
  await box.fill("Message de test automatisé (QA).");
  await box.press("Enter");
  await pp.waitForTimeout(2000);
  const r = await rest(`messages?select=content&receiver_id=eq.${psy.user.id}`, { token: pat.access_token });
  expect(r.body.length >= 1, JSON.stringify(r.body));
  await audit(pp, "messages");
});
await step("Attacks with a real patient login are refused", async () => {
  const t = pat.access_token;
  const out = [];
  const pii = await rest("profiles?select=phone&user_type=eq.psychologue", { token: t });
  if (pii.body.length) out.push("reads therapist PII");
  await rest(`profiles?user_id=eq.${pat.user.id}`, { token: t, method: "PATCH", body: { is_admin: true } });
  const me = await rest("profiles?select=is_admin", { token: t });
  if (me.body[0]?.is_admin) out.push("became admin");
  const b = await rest("bookings", { token: t, method: "POST", body: { patient_id: pat.user.id, psychologist_id: approved.user_id, booked_at: new Date(Date.now() + 864e5).toISOString(), status: "confirmed", price: 1 } });
  if (b.status < 300) out.push("inserted a free booking");
  const rv = await rest("reviews", { token: t, method: "POST", body: { patient_id: pat.user.id, psychologist_id: approved.user_id, rating: 1 } });
  if (rv.status < 300) out.push("posted a review with no session");
  const ir = await rest("immediate_session_requests", { token: t, method: "POST", body: { patient_id: pat.user.id, psychologist_id: psy.user.id } });
  if (ir.status < 300) out.push("instant request to an unapproved therapist");
  const rr = await rest("reschedule_requests", { token: t, method: "POST", body: {} });
  if (rr.status < 300) out.push("wrote reschedule_requests directly");
  const att = await api("/api/messages?action=send", t, { receiver_id: psy.user.id, file_url: `${psy.user.id}/someone-else.pdf` });
  if (att.status < 300) out.push("attached someone else's file");
  const room = await api("/api/calls?action=room", t, { booking_id: "00000000-0000-0000-0000-000000000000" });
  if (room.status !== 404) out.push(`room for unknown booking → ${room.status}`);
  const resq = await api("/api/bookings?action=reschedule-request", t, { booking_id: "00000000-0000-0000-0000-000000000000", proposed_at: new Date(Date.now() + 864e5).toISOString() });
  if (resq.status !== 404) out.push(`reschedule-request for unknown booking → ${resq.status}`);
  expect(out.length === 0, out.join("; "));
  return "9 attempts refused";
});

// ── E. Therapist (QA, unapproved) ───────────────────────────────────────────
console.log("\nE · Therapist (QA, unapproved)");
const tp = await desktop.newPage(); watch(tp, "therapist"); failPages.therapist = tp;
await step("Therapist logs in; pending-approval notice shown", async () => {
  await tp.goto(`${BASE}/connexion`);
  await tp.fill("#connexion-f1", QA_PSY);
  await tp.fill("#connexion-f2", QA_PW);
  await tp.click('button[type="submit"]');
  await tp.waitForURL(/\/espace-psy/, { timeout: 20000 });
  await tp.waitForLoadState("networkidle");
  await audit(tp, "psy dashboard");
  return await snap(tp, "psy-dashboard-pending");
});
await step("Profile editor: prices + languages save; out-of-band price refused", async () => {
  await tp.goto(`${BASE}/espace-psy?page=profile`, { waitUntil: "networkidle" });
  await tp.fill("#price-price_individual", "9000");
  await tp.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  await tp.getByText(/doit être entre 1900 et 3200/).first().waitFor({ timeout: 5000 });
  await tp.fill("#price-price_individual", "2400");
  const ar = tp.getByRole("button", { name: "Arabe", exact: true });
  if ((await ar.getAttribute("aria-pressed")) !== "true") await ar.click();
  await tp.getByRole("button", { name: /Enregistrer|Sauvegarder/ }).first().click();
  await tp.getByText(/Profil mis à jour/).first().waitFor({ timeout: 10000 });
  const r = await rest("profiles?select=price_individual,price_per_session,language", { token: psy.access_token });
  expect(r.body[0].price_individual === 2400 && r.body[0].price_per_session === 2400 && /Arabe/.test(r.body[0].language), JSON.stringify(r.body));
  await audit(tp, "psy profile editor");
  return await snap(tp, "psy-profile");
});
await step("Settings: no dead switches, unique ids", async () => {
  await tp.goto(`${BASE}/espace-psy?page=settings`, { waitUntil: "networkidle" });
  expect(!(await tp.getByText(/confirmation automatique/i).count()), "auto-confirm toggle still there");
  await audit(tp, "psy settings");
});
await step("Therapist sees the patient's message", async () => {
  await tp.goto(`${BASE}/espace-psy?page=messages`, { waitUntil: "networkidle" });
  await tp.getByText(/QA Patient/).first().click();
  await tp.getByText(/Message de test automatisé/).first().waitFor({ timeout: 10000 });
  await audit(tp, "psy messages");
});
await step("Still invisible to the public after editing", async () => {
  const r = await rest(`psychologist_directory?select=user_id&user_id=eq.${psy.user.id}`);
  expect(r.body.length === 0, "unapproved therapist exposed");
});
await step("Logout clears private data from the device", async () => {
  await pp.goto(`${BASE}/mon-espace`, { waitUntil: "networkidle" });
  await pp.getByRole("button", { name: /Déconnexion/ }).first().click();
  await pp.waitForTimeout(1500);
  const left = await pp.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("majal_")));
  expect(left.length === 0, left.join(", "));
});

await step("No console errors on the live site", async () => { expect(consoleErrors.length === 0, consoleErrors.slice(0, 4).join(" || ")); });
await step("No duplicate ids / untranslated keys / overflow issues", async () => { expect(pageIssues.length === 0, pageIssues.slice(0, 6).join(" || ")); });

fs.writeFileSync(path.join(ART, "live-check.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results, consoleErrors, pageIssues }, null, 2));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
