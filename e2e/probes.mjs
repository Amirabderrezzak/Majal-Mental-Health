// Security / data-integrity probes run directly against the database through the
// Supabase client (what a malicious signed-in user could do with the public anon
// key and their own login — no UI involved).
//
//   node e2e/probes.mjs            → probes the current migrations
//   node e2e/probes.mjs --before   → same probes on the schema BEFORE the audit
//                                    fixes (original migrations + only the drift
//                                    reconciliation needed for a fresh build)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createGateway, ANON_KEY, SERVICE_KEY } from "./stack/gateway.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const before = process.argv.includes("--before");
const DBNAME = before ? "majal_before" : "majal_probe";
const PORT = before ? 54331 : 54332;

let migrationsDir = path.join(root, "supabase/migrations");
if (before) {
  migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), "majal-before-"));
  const files = execFileSync("git", ["ls-tree", "--name-only", "03921b0", "supabase/migrations/"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  for (const f of files) fs.writeFileSync(path.join(migrationsDir, path.basename(f)), execFileSync("git", ["show", `03921b0:${f}`], { cwd: root }));
  fs.copyFileSync(path.join(root, "supabase/migrations/20260918230000_reconcile_schema_drift.sql"), path.join(migrationsDir, "20260918230000_reconcile_schema_drift.sql"));
}
execFileSync(path.join(here, "stack/reset-db.sh"), { env: { ...process.env, DBNAME, MIGRATIONS_DIR: migrationsDir }, stdio: "ignore" });
const { server, pool } = await createGateway({ connectionString: `postgresql://postgres@localhost:54322/${DBNAME}?host=/tmp`, port: PORT });
const URL_ = `http://localhost:${PORT}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL_, SERVICE_KEY, opts);
const anon = createClient(URL_, ANON_KEY, opts);

async function user(email, data) {
  const c = createClient(URL_, ANON_KEY, opts);
  const { data: s, error } = await c.auth.signUp({ email, password: "motdepasse-123", options: { data } });
  if (error) throw error;
  return { c, id: s.user.id };
}
const psy = await user("psy@probe.dz", { full_name: "Dr Probe", user_type: "psychologue", phone: "0555 11 22 33", order_number: "ORD-42" });
const pending = await user("pending@probe.dz", { full_name: "Dr Pending", user_type: "psychologue", phone: "0666 00 00 00", order_number: "ORD-99" });
const pat = await user("pat@probe.dz", { full_name: "Patient Probe" });
const other = await user("other@probe.dz", { full_name: "Autre Patient" });
await pool.query("UPDATE profiles SET approval_status='approved', price_individual=2500 WHERE user_id=$1", [psy.id]);

const results = [];
const check = (name, vulnerable, detail = "") => results.push({ name, vulnerable, detail });

// 1. therapist PII
{
  const { data } = await pat.c.from("profiles").select("user_id, phone, order_number, is_admin").in("user_id", [psy.id, pending.id]);
  check("A patient can read therapists' phone / licence number / admin flag (incl. unapproved accounts)", (data?.length ?? 0) > 0, JSON.stringify(data));
}
// 2. self-promotion to admin
{
  const { error } = await pat.c.from("profiles").update({ is_admin: true }).eq("user_id", pat.id);
  const { data } = await service.from("profiles").select("is_admin").eq("user_id", pat.id).single();
  check("A patient can make themselves admin", data?.is_admin === true, error?.message);
}
// 3. free confirmed booking
{
  const { error } = await pat.c.from("bookings").insert({ patient_id: pat.id, psychologist_id: psy.id, booked_at: new Date(Date.now() + 86400e3).toISOString(), status: "confirmed", price: 1 });
  check("A patient can insert a confirmed booking without paying", !error, error?.message);
}
// 4. fake reviews
{
  let inserted = 0;
  for (let i = 0; i < 3; i++) {
    const { error } = await other.c.from("reviews").insert({ patient_id: other.id, psychologist_id: psy.id, rating: 1, comment: "faux avis" });
    if (!error) inserted++;
  }
  check("Anyone signed in can post unlimited reviews with no session", inserted > 0, `${inserted} reviews inserted`);
}
// 5. reviewer identity public
{
  await service.from("reviews").insert({ patient_id: pat.id, psychologist_id: psy.id, rating: 5 });
  const { data, error } = await anon.from("reviews").select("patient_id").limit(5);
  check("Anonymous visitors can see which user wrote each review (patient_id)", !error && (data?.length ?? 0) > 0, JSON.stringify(data));
}
// 6. forum anonymity
{
  await pat.c.from("forum_threads").insert({ author_id: pat.id, category: "anxiety", title: "Je n'arrive plus à dormir", content: "…" });
  const { data, error } = await anon.from("forum_threads").select("author_id, title");
  const leaks = (data ?? []).some((r) => r.author_id === pat.id);
  check("An 'anonymous' forum post exposes the author's user id to anyone", !error && leaks, JSON.stringify(data));
}
// 7. instant request to an unapproved account
{
  const { error } = await pat.c.from("immediate_session_requests").insert({ patient_id: pat.id, psychologist_id: pending.id });
  check("A patient can send an instant-session request to an unapproved therapist", !error, error?.message);
}
// 8. therapist forging an accepted instant request (bypassing payment/API)
{
  const { data: req } = await service.from("immediate_session_requests").insert({ patient_id: other.id, psychologist_id: psy.id }).select("id").single();
  const { data } = await psy.c.from("immediate_session_requests").update({ status: "accepted", room_url: "https://evil.example/room" }).eq("id", req.id).select("status");
  check("A therapist can mark an instant request accepted with any room URL, bypassing the API", (data?.length ?? 0) > 0, JSON.stringify(data));
}
// 9. homepage counters for anonymous visitors
{
  const { count } = await anon.from("profiles").select("user_id", { count: "exact", head: true }).eq("user_type", "psychologue").eq("approval_status", "approved");
  const { data: stats } = await anon.rpc("public_stats").then((r) => r, () => ({ data: null }));
  check("Homepage shows 0 psychologists to anonymous visitors", !(count || stats?.psychologists), `count=${count} rpc=${JSON.stringify(stats)}`);
}
// 10. payment tampering
{
  const { data: p } = await service.from("payments").insert({ patient_id: pat.id, psychologist_id: psy.id, booked_at: new Date().toISOString(), price: 2500, status: "pending" }).select("id").single();
  await pat.c.from("payments").update({ status: "confirmed" }).eq("id", p.id);
  const { data } = await service.from("payments").select("status").eq("id", p.id).single();
  check("A patient can mark their own payment as confirmed", data?.status === "confirmed");
}

server.close();
await pool.end();
const label = before ? "BEFORE the fixes (original migrations)" : "AFTER the fixes (current migrations)";
console.log(`\n${label}`);
for (const r of results) console.log(`${r.vulnerable ? "✗ VULNERABLE" : "✓ blocked   "}  ${r.name}${r.vulnerable && r.detail ? `\n               ${r.detail.slice(0, 160)}` : ""}`);
const bad = results.filter((r) => r.vulnerable).length;
console.log(`${bad}/${results.length} vulnerable`);
fs.mkdirSync(path.join(here, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(here, "artifacts", `probes-${before ? "before" : "after"}.json`), JSON.stringify(results, null, 2));
process.exit(before ? 0 : bad ? 1 : 0);
