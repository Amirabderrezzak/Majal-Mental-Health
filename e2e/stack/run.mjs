// Starts the whole local stack:
//   Postgres (must be running on PGPORT, default 54322; see README) — rebuilt from
//   supabase/migrations, gateway :54321, api handlers :3001, fake Daily :54400,
//   and the real frontend (Vite) on :8080.
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGateway, ANON_KEY, SERVICE_KEY } from "./gateway.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const PGPORT = process.env.PGPORT || "54322";
const PGHOST = process.env.PGHOST || "/tmp";
const DB_URL = `postgresql://postgres@localhost:${PGPORT}/majal?host=${PGHOST}`;

if (!process.env.SKIP_RESET) {
  execFileSync(path.join(here, "reset-db.sh"), { stdio: ["ignore", "ignore", "ignore"], env: { ...process.env, PGPORT, PGHOST } });
  console.log("[db] rebuilt from supabase/migrations");
}

await createGateway({ connectionString: DB_URL, port: 54321 });
console.log("[gateway] REST+Auth on :54321");

const apiEnv = {
  ...process.env,
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  DAILY_API_KEY: "daily-test-key",
  DAILY_API_BASE: "http://localhost:54400/v1",
  RESEND_API_KEY: "re_test_key",
  CRON_SECRET: "cron-test-secret",
  FRONTEND_URL: "http://localhost:8080",
  NODE_ENV: "development", // no SofizPay key → mock gateway (refused in production)
};
const children = [];
const start = (cmd, args, env, name) => {
  const p = spawn(cmd, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  children.push(p);
};
start(path.join(root, "node_modules/.bin/tsx"), ["e2e/stack/api-server.ts"], apiEnv, "api");
start(path.join(root, "node_modules/.bin/vite"), ["--port", "8080", "--strictPort", "--host", "127.0.0.1"], {
  ...process.env,
  VITE_SUPABASE_URL: "http://localhost:54321",
  VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
}, "vite");

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { children.forEach((c) => c.kill()); process.exit(0); });
console.log(`[stack] DB ${DB_URL}`);
