// A small Supabase-compatible gateway for local end-to-end tests.
//
//   /rest/v1/*  → PostgREST-compatible subset (the operators supabase-js uses in
//                 this app). Every query runs as the caller's role with
//                 request.jwt.claims set, so Row Level Security is enforced by
//                 Postgres exactly as on Supabase.
//   /auth/v1/*  → GoTrue-compatible subset (signup, password login, refresh,
//                 user, admin getUserById). Users auto-confirmed.
//
// Not a production server. It exists so the real migrations, RLS policies,
// triggers and api/ handlers can be exercised end to end without Docker.
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";

// Shared test clock (POST /__clock {offsetMs}): tokens are issued and checked on
// the same shifted time as the API and the browser, otherwise jumping the clock
// to "session time" makes every token look expired.
let clockOffset = 0;
const now = () => Date.now() + clockOffset;

export const JWT_SECRET = "majal-e2e-jwt-secret-at-least-32-characters";

// Return timestamps exactly as PostgREST does ("2026-11-29T08:00:00+00:00"),
// not as JS Dates, so string comparisons in the app behave as in production.
pg.types.setTypeParser(1184, (v) => v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
pg.types.setTypeParser(1114, (v) => v.replace(" ", "T"));

const b64u = (buf) => Buffer.from(buf).toString("base64url");
export function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
export function verifyJwt(token) {
  const [h, b, s] = String(token || "").split(".");
  if (!h || !b || !s) return null;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
  if (sig.length !== s.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(b, "base64url").toString());
  if (claims.exp && claims.exp * 1000 < now()) return null;
  return claims;
}
export const ANON_KEY = signJwt({ role: "anon", iss: "majal-e2e", iat: 1700000000, exp: 4000000000 });
export const SERVICE_KEY = signJwt({ role: "service_role", iss: "majal-e2e", iat: 1700000000, exp: 4000000000 });

const ident = (s) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { status: 400 });
  return `"${s}"`;
};

// ── filter parsing ──────────────────────────────────────────────────────────
function splitTop(str) {
  const out = []; let depth = 0; let cur = ""; let quote = false;
  for (const ch of str) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === "(") depth++;
    if (!quote && ch === ")") depth--;
    if (!quote && depth === 0 && ch === ",") { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function parseList(v) {
  const inner = v.replace(/^\(/, "").replace(/\)$/, "");
  return splitTop(inner).map((x) => x.replace(/^"(.*)"$/, "$1"));
}
function condition(col, expr, params) {
  let negate = false;
  if (expr.startsWith("not.")) { negate = true; expr = expr.slice(4); }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const val = expr.slice(dot + 1);
  const c = ident(col);
  const p = (v) => { params.push(v); return `$${params.length}`; };
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${p(val)}`; break;
    case "neq": sql = `${c} <> ${p(val)}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c} LIKE ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c} ILIKE ${p(val.replace(/\*/g, "%"))}`; break;
    case "in": {
      const items = parseList(val);
      sql = items.length ? `${c} IN (${items.map((i) => p(i)).join(", ")})` : "false";
      break;
    }
    case "is": sql = `${c} IS ${val === "null" ? "NULL" : val === "true" ? "TRUE" : val === "false" ? "FALSE" : "UNKNOWN"}`; break;
    default: throw Object.assign(new Error(`unsupported operator ${op}`), { status: 400 });
  }
  return negate ? `NOT (${sql})` : sql;
}
function logical(kind, body, params) {
  const parts = splitTop(body.replace(/^\(/, "").replace(/\)$/, "")).map((part) => {
    const m = part.match(/^(and|or)\((.*)\)$/);
    if (m) return logical(m[1], `(${m[2]})`, params);
    const dot = part.indexOf(".");
    return condition(part.slice(0, dot), part.slice(dot + 1), params);
  });
  return `(${parts.join(kind === "and" ? " AND " : " OR ")})`;
}
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function buildWhere(search, params) {
  const conds = [];
  for (const [k, v] of search) {
    if (RESERVED.has(k)) continue;
    if (k === "or" || k === "and") conds.push(logical(k, v, params));
    else conds.push(condition(k, v, params));
  }
  return conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
}
function selectList(sel) {
  if (!sel || sel.trim() === "*") return "*";
  return sel.split(",").map((s) => s.trim()).filter(Boolean).map((c) => {
    if (c.includes("(")) throw Object.assign(new Error(`embedding not supported: ${c}`), { status: 400 });
    return ident(c);
  }).join(", ");
}
function orderBy(order) {
  if (!order) return "";
  return " ORDER BY " + order.split(",").map((o) => {
    const [col, dir, nulls] = o.split(".");
    return `${ident(col)} ${dir === "desc" ? "DESC" : "ASC"}${nulls === "nullsfirst" ? " NULLS FIRST" : nulls === "nullslast" ? " NULLS LAST" : ""}`;
  }).join(", ");
}
const toParam = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);

// ── database session per request ─────────────────────────────────────────────
export function createGateway({ connectionString, port = 54321 }) {
  const pool = new pg.Pool({ connectionString, max: 20, options: "-c TimeZone=UTC" });
  const refreshTokens = new Map(); // token -> user id

  async function asRole(claims, fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const role = claims?.role === "service_role" ? "service_role" : claims?.role === "authenticated" ? "authenticated" : "anon";
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims || { role: "anon" })]);
      const r = await fn(client);
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  const userJson = (u) => ({
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email, phone: u.phone || "",
    email_confirmed_at: u.created_at, confirmed_at: u.created_at, created_at: u.created_at, updated_at: u.created_at,
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.raw_user_meta_data || {}, identities: [],
  });
  function session(u) {
    const nowS = Math.floor(now() / 1000);
    const access_token = signJwt({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, iat: nowS, exp: nowS + 3600, session_id: crypto.randomUUID() });
    const refresh_token = crypto.randomBytes(24).toString("hex");
    refreshTokens.set(refresh_token, u.id);
    return { access_token, token_type: "bearer", expires_in: 3600, expires_at: nowS + 3600, refresh_token, user: userJson(u) };
  }
  const getUser = async (id) => (await pool.query("SELECT * FROM auth.users WHERE id = $1", [id])).rows[0];

  async function auth(req, res, path, body, claims) {
    const send = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (path === "/signup" && req.method === "POST") {
      const { email, password, data } = body;
      if (!email || !password) return send(400, { code: 400, msg: "missing email or password" });
      try {
        const { rows } = await pool.query(
          "INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data) VALUES (lower($1), crypt($2, gen_salt('bf')), $3) RETURNING *",
          [email, password, data || {}]);
        return send(200, session(rows[0]));
      } catch (e) {
        if (e.code === "23505") return send(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
        throw e;
      }
    }
    if (path === "/token" && req.method === "POST") {
      const grant = new URL(req.url, "http://x").searchParams.get("grant_type");
      if (grant === "password") {
        const { rows } = await pool.query("SELECT * FROM auth.users WHERE email = lower($1) AND encrypted_password = crypt($2, encrypted_password)", [body.email, body.password]);
        if (!rows[0]) return send(400, { error: "invalid_grant", error_description: "Invalid login credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return send(200, session(rows[0]));
      }
      if (grant === "refresh_token") {
        const uid = refreshTokens.get(body.refresh_token);
        const u = uid && (await getUser(uid));
        if (!u) return send(400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
        return send(200, session(u));
      }
    }
    if (path === "/user") {
      if (claims?.role !== "authenticated") return send(401, { code: 401, msg: "invalid JWT" });
      if (req.method === "PUT" && body.password) {
        await pool.query("UPDATE auth.users SET encrypted_password = crypt($2, gen_salt('bf')) WHERE id = $1", [claims.sub, body.password]);
      }
      const u = await getUser(claims.sub);
      return u ? send(200, userJson(u)) : send(404, { msg: "User not found" });
    }
    if (path === "/logout") { res.writeHead(204); return res.end(); }
    if (path === "/recover" || path === "/otp") return send(200, {});
    const adm = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/);
    if (adm) {
      if (claims?.role !== "service_role") return send(403, { msg: "forbidden" });
      const u = await getUser(adm[1]);
      return u ? send(200, userJson(u)) : send(404, { msg: "User not found" });
    }
    return send(404, { msg: `auth endpoint not implemented: ${req.method} ${path}` });
  }

  async function rest(req, res, path, rawBody, claims) {
    const url = new URL(req.url, "http://x");
    const search = [...url.searchParams];
    const prefer = String(req.headers.prefer || "");
    const wantObject = String(req.headers.accept || "").includes("application/vnd.pgrst.object+json");
    const params = [];

    const rpc = path.match(/^\/rpc\/([a-z_]+)$/);
    let rows; let count = null; let status = 200;

    await asRole(claims, async (db) => {
      if (rpc) {
        const args = rawBody ? JSON.parse(rawBody) : {};
        const named = Object.entries(args).map(([k, v]) => { params.push(toParam(v)); return `${ident(k)} => $${params.length}`; });
        // Set-returning functions come back as an array of rows (as PostgREST does).
        const { rows: meta } = await db.query("SELECT bool_or(proretset) AS retset FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace", [rpc[1]]);
        if (meta[0]?.retset) {
          rows = (await db.query(`SELECT * FROM ${ident(rpc[1])}(${named.join(", ")})`, params)).rows;
        } else {
          const { rows: r } = await db.query(`SELECT ${ident(rpc[1])}(${named.join(", ")}) AS result`, params);
          rows = r[0]?.result ?? null;
        }
        return;
      }
      const table = ident(path.replace(/^\//, "").split("/")[0]);
      const sel = url.searchParams.get("select");
      const returning = prefer.includes("return=representation") ? ` RETURNING ${selectList(sel)}` : "";

      if (req.method === "GET" || req.method === "HEAD") {
        const where = buildWhere(search, params);
        if (prefer.includes("count=exact")) {
          count = Number((await db.query(`SELECT count(*) FROM ${table}${where}`, params)).rows[0].count);
        }
        const limit = url.searchParams.get("limit");
        const offset = url.searchParams.get("offset");
        const q = `SELECT ${selectList(sel)} FROM ${table}${where}${orderBy(url.searchParams.get("order"))}${limit ? ` LIMIT ${Number(limit)}` : ""}${offset ? ` OFFSET ${Number(offset)}` : ""}`;
        rows = req.method === "HEAD" ? [] : (await db.query(q, params)).rows;
      } else if (req.method === "POST") {
        const body = JSON.parse(rawBody || "{}");
        const items = Array.isArray(body) ? body : [body];
        const cols = [...new Set(items.flatMap((i) => Object.keys(i)))];
        const values = items.map((i) => `(${cols.map((c) => { if (!(c in i)) return "DEFAULT"; params.push(toParam(i[c])); return `$${params.length}`; }).join(", ")})`);
        let conflict = "";
        if (prefer.includes("resolution=merge-duplicates") || prefer.includes("resolution=ignore-duplicates")) {
          const on = url.searchParams.get("on_conflict");
          const target = on ? `(${on.split(",").map((c) => ident(c.trim())).join(", ")})` : "";
          conflict = prefer.includes("ignore-duplicates")
            ? ` ON CONFLICT ${target} DO NOTHING`
            : ` ON CONFLICT ${target} DO UPDATE SET ${cols.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`;
        }
        rows = (await db.query(`INSERT INTO ${table} (${cols.map(ident).join(", ")}) VALUES ${values.join(", ")}${conflict}${returning}`, params)).rows;
        status = 201;
      } else if (req.method === "PATCH") {
        const body = JSON.parse(rawBody || "{}");
        const sets = Object.entries(body).map(([k, v]) => { params.push(toParam(v)); return `${ident(k)} = $${params.length}`; });
        const where = buildWhere(search, params);
        rows = (await db.query(`UPDATE ${table} SET ${sets.join(", ")}${where}${returning}`, params)).rows;
      } else if (req.method === "DELETE") {
        const where = buildWhere(search, params);
        rows = (await db.query(`DELETE FROM ${table}${where}${returning}`, params)).rows;
      }
    });

    const headers = { "Content-Type": "application/json" };
    if (count !== null) headers["Content-Range"] = `${rows.length ? `0-${rows.length - 1}` : "*"}/${count}`;
    if (rpc) { res.writeHead(200, headers); return res.end(JSON.stringify(rows)); }
    if (wantObject) {
      if (rows.length !== 1) {
        res.writeHead(406, headers);
        return res.end(JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null }));
      }
      res.writeHead(status, headers);
      return res.end(JSON.stringify(rows[0]));
    }
    const noBody = (req.method !== "GET" && !prefer.includes("return=representation")) || req.method === "HEAD";
    res.writeHead(noBody && status === 200 ? 204 : noBody ? 201 : status, headers);
    res.end(noBody ? "" : JSON.stringify(rows));
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "") || req.headers.apikey;
    const claims = verifyJwt(token);
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__clock" && req.method === "POST") {
      clockOffset = Number(JSON.parse(raw || "{}").offsetMs ?? 0);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ offsetMs: clockOffset }));
    }
    try {
      if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url.pathname.slice(8), raw ? JSON.parse(raw) : {}, claims);
      if (url.pathname.startsWith("/rest/v1")) return await rest(req, res, url.pathname.slice(8), raw, claims);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "not found (storage/realtime are not emulated)" }));
    } catch (e) {
      const status = e.status || (e.code === "23505" ? 409 : e.code === "42501" ? 403 : e.code === "23514" || e.code === "22P02" || e.code === "23503" ? 400 : e.code ? 400 : 500);
      if (status === 500) console.error("[gateway]", e);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: e.code || String(status), message: e.message, details: e.detail || null, hint: e.hint || null }));
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, pool })));
}
