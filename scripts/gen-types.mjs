#!/usr/bin/env node
// Generates src/integrations/supabase/types.ts from a real Postgres schema, in the
// same shape as `supabase gen types typescript`.
//
// Usage: DATABASE_URL=postgres://… node scripts/gen-types.mjs
// (defaults to the local e2e database built by e2e/stack/reset-db.sh)
//
// Prefer `supabase gen types typescript --linked` when you have the Supabase CLI
// and Docker; this exists because the old generator (_gen_types.mjs) regexed the
// migration files and silently dropped views, functions and relationships.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const DB = process.env.DATABASE_URL || "postgresql://postgres@localhost:54322/majal?host=/tmp";
const q = (sql) => JSON.parse(execFileSync("psql", [DB, "-At", "-c", sql], { encoding: "utf8" }).trim() || "null") ?? [];

const columns = q(`
  SELECT json_agg(json_build_object(
    'table', c.table_name, 'name', c.column_name, 'udt', c.udt_name, 'data_type', c.data_type,
    'nullable', c.is_nullable = 'YES', 'has_default', c.column_default IS NOT NULL OR c.is_identity = 'YES',
    'kind', t.table_type) ORDER BY c.table_name, c.column_name)
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'`);

const fks = q(`
  SELECT json_agg(json_build_object(
    'table', cl.relname, 'name', con.conname, 'cols', (SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)),
    'ref', rcl.relname, 'refschema', rns.nspname, 'refcols', (SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = con.confrelid AND a.attnum = ANY(con.confkey)),
    'one', EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = con.conrelid AND i.indisunique AND i.indkey::int2[] @> con.conkey AND array_length(i.indkey::int2[], 1) = array_length(con.conkey, 1))
  ) ORDER BY cl.relname, con.conname)
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
  JOIN pg_class rcl ON rcl.oid = con.confrelid JOIN pg_namespace rns ON rns.oid = rcl.relnamespace
  WHERE con.contype = 'f' AND ns.nspname = 'public'`);

const functions = q(`
  SELECT json_agg(json_build_object(
    'name', p.proname,
    'args', (SELECT json_agg(json_build_object('name', n, 'type', format_type(t, NULL))) FROM unnest(p.proargnames[1:p.pronargs], p.proargtypes::oid[]) AS x(n, t)),
    'ret', format_type(p.prorettype, NULL), 'retset', p.proretset) ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND format_type(p.prorettype, NULL) NOT IN ('trigger', 'event_trigger')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`);

const tsType = (udt) => {
  if (udt.startsWith("_")) return `${tsType(udt.slice(1))}[]`;
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(udt)) return "number";
  if (udt === "bool") return "boolean";
  if (udt === "json" || udt === "jsonb") return "Json";
  return "string";
};
const pgTs = (t) => {
  if (t === "void") return "undefined";
  if (/^(integer|bigint|smallint|numeric|real|double precision)$/.test(t)) return "number";
  if (t === "boolean") return "boolean";
  if (t === "json" || t === "jsonb") return "Json";
  return "string";
};

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table)) byTable.set(c.table, { kind: c.kind, cols: [] });
  byTable.get(c.table).cols.push(c);
}
const rels = (name) => fks.filter((f) => f.table === name).map((f) => `          {
            foreignKeyName: "${f.name}"
            columns: [${f.cols.map((c) => `"${c}"`).join(", ")}]
            isOneToOne: ${f.one}
            referencedRelation: "${f.ref}"
            referencedColumns: [${f.refcols.map((c) => `"${c}"`).join(", ")}]
          },`).join("\n");

const block = (name, { cols }, isView) => {
  const row = cols.map((c) => `          ${c.name}: ${tsType(c.udt)}${c.nullable || isView ? " | null" : ""}`).join("\n");
  const ins = cols.map((c) => `          ${c.name}${c.nullable || c.has_default || isView ? "?" : ""}: ${tsType(c.udt)}${c.nullable || isView ? " | null" : ""}`).join("\n");
  const upd = cols.map((c) => `          ${c.name}?: ${tsType(c.udt)}${c.nullable || isView ? " | null" : ""}`).join("\n");
  const r = rels(name);
  return `      ${name}: {
        Row: {
${row}
        }
        Insert: {
${ins}
        }
        Update: {
${upd}
        }
        Relationships: ${r ? `[\n${r}\n        ]` : "[]"}
      }`;
};

const tables = [...byTable].filter(([, v]) => v.kind === "BASE TABLE").map(([n, v]) => block(n, v, false)).join("\n");
const views = [...byTable].filter(([, v]) => v.kind === "VIEW").map(([n, v]) => block(n, v, true)).join("\n");
const fns = functions.map((f) => {
  const args = f.args && f.args.length ? `{ ${f.args.map((a) => `${a.name}: ${pgTs(a.type)}`).join("; ")} }` : "never";
  return `      ${f.name}: { Args: ${args}; Returns: ${pgTs(f.ret)}${f.retset ? "[]" : ""} }`;
}).join("\n");

const file = "src/integrations/supabase/types.ts";
const existing = fs.readFileSync(file, "utf8");
const helpers = existing.slice(existing.indexOf("type DatabaseWithoutInternals"));

const out = `// Generated by scripts/gen-types.mjs from the schema built by supabase/migrations.
// Regenerate after adding a migration (see the script header).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
${tables}
    }
    Views: {
${views}
    }
    Functions: {
${fns}
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

${helpers}`;
fs.writeFileSync(file, out);
console.log(`types.ts: ${[...byTable].length} relations, ${functions.length} functions`);
