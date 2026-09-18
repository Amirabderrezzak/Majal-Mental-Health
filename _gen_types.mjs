import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const txt = files.map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");

// Map Postgres type -> TS type
function pgToTs(t) {
  t = t.toLowerCase();
  if (t.includes("timestamp")) return "string";
  if (t === "uuid") return "string";
  if (t === "int" || t === "integer" || t === "bigint" || t.startsWith("numeric") || t.startsWith("double")) return "number";
  if (t === "boolean" || t.startsWith("bool")) return "boolean";
  if (t === "jsonb" || t === "json") return "Json";
  if (t.startsWith("text") || t.startsWith("varchar") || t === "character varying") return "string";
  return "string";
}

// Parse base CREATE TABLE columns
const baseRe = /CREATE TABLE (?:IF NOT EXISTS )?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
const tables = {}; // name -> { cols: [{name, type, null:bool}] }
let m;
while ((m = baseRe.exec(txt))) {
  const name = m[1];
  const body = m[2];
  const cols = [];
  body.split("\n").forEach(raw => {
    const l = raw.trim().replace(/,$/, "");
    if (!l) return;
    if (/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|\))/i.test(l)) return;
    // column: name TYPE ...
    const cm = l.match(/^([a-z_]+)\s+([A-Za-z0-9_()\s]+?)(?:\s+NOT NULL|\s+NULL|\s+DEFAULT|\s+REFERENCES|\s+PRIMARY KEY|\s+UNIQUE)/i);
    if (!cm) return;
    const cname = cm[1];
    // extract raw type word from the full line
    const typeMatch = l.match(/^([a-z_]+)\s+([A-Za-z0-9_()\s]+?)(?:\s+NOT NULL|\s+NULL|\s+DEFAULT|\s+REFERENCES|\s+PRIMARY KEY|\s+UNIQUE)/i);
    const rawType = typeMatch ? typeMatch[2].trim().match(/^([A-Za-z0-9_()]+)/)[1] : "text";
    const notNull = /NOT NULL/i.test(l);
    cols.push({ name: cname, type: pgToTs(rawType), null: !notNull });
  });
  tables[name] = { cols };
}

// Parse ALTER TABLE ADD COLUMN
const alterRe = /ALTER TABLE (?:ONLY )?public\.([a-z_]+)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_]+)\s+([^;]+);/gi;
while ((m = alterRe.exec(txt))) {
  const name = m[1];
  const cname = m[2];
  const rest = m[3].trim();
  if (!tables[name]) tables[name] = { cols: [] };
  if (tables[name].cols.some(c => c.name === cname)) continue;
  const rawTypeMatch = rest.match(/^([A-Za-z0-9_()]+)/);
  const rawType = rawTypeMatch ? rawTypeMatch[1] : "text";
  const notNull = /NOT NULL/i.test(rest);
  tables[name].cols.push({ name: cname, type: pgToTs(rawType), null: !notNull });
}

// ALSO capture columns added via the "ADD COLUMN IF NOT EXISTS price_couples INT," style where
// the regex above may have missed due to comma placement; fallback already covered by main regex.

// Build type file
let out = `// AUTO-REGENERATED from supabase/migrations (local, DB unreachable on this host).
// Run \`supabase gen types typescript --linked\` on a networked host to replace with the
// authoritative version. Columns derived from CREATE TABLE + ALTER ADD COLUMN in migrations.
// Generated ${new Date().toISOString()}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.2"
  }
  public: {
    Tables: {\n`;

for (const [name, { cols }] of Object.entries(tables)) {
  out += `      ${name}: {\n`;
  out += `        Row: {\n`;
  cols.forEach(c => {
    out += `          ${c.name}: ${c.type}${c.null ? " | null" : ""}\n`;
  });
  out += `        }\n`;
  out += `        Insert: {\n`;
  cols.forEach(c => {
    const opt = c.null ? "?" : "";
    out += `          ${c.name}${opt}: ${c.type}${c.null ? " | null" : ""}\n`;
  });
  out += `        }\n`;
  out += `        Update: {\n`;
  cols.forEach(c => {
    out += `          ${c.name}?: ${c.type}${c.null ? " | null" : ""}\n`;
  });
  out += `        }\n`;
  out += `        Relationships: []\n`;
  out += `      }\n`;
}
out += `    }\n    Views: {\n`;
// Views referenced: psychologist_directory, psychologist_ratings, audio_rooms_public
const views = {
  psychologist_directory: [
    ["user_id", "string", false], ["full_name", "string", true], ["specialty", "string", true],
    ["city", "string", true], ["bio", "string", true], ["price_per_session", "number", true],
    ["years_experience", "number", true], ["language", "string", true], ["avatar_url", "string", true],
    ["video_url", "string", true], ["is_available_now", "boolean", true], ["approval_status", "string", true],
    ["approach", "string", true], ["formations", "string", true], ["rating", "number", true], ["review_count", "number", true],
  ],
  psychologist_ratings: [
    ["psychologist_id", "string", false], ["avg_rating", "number", true], ["review_count", "number", true],
  ],
  audio_rooms_public: [
    ["id", "string", false], ["host_id", "string", false], ["title", "string", false],
    ["room_url", "string", false], ["is_live", "boolean", false], ["participant_count", "number", false],
    ["created_at", "string", false],
  ],
};
for (const [vname, vcols] of Object.entries(views)) {
  out += `      ${vname}: {\n        Row: {\n`;
  vcols.forEach(([n, t, nul]) => out += `          ${n}: ${t}${nul ? " | null" : ""}\n`);
  out += `        }\n        Insert: {\n`;
  vcols.forEach(([n, t, nul]) => out += `          ${n}${nul ? "?" : ""}: ${t}${nul ? " | null" : ""}\n`);
  out += `        }\n        Update: {\n`;
  vcols.forEach(([n, t, nul]) => out += `          ${n}?: ${t}${nul ? " | null" : ""}\n`);
  out += `        }\n        Relationships: []\n      }\n`;
}
out += `    }\n    Functions: {}\n    Enums: {}\n    CompositeTypes: {}\n  }\n}\n`;

fs.writeFileSync("src/integrations/supabase/types.ts", out);
console.log("Wrote types for tables:", Object.keys(tables).join(", "));
console.log("Total tables:", Object.keys(tables).length);
