// Lists t("key") calls whose key is not defined in LanguageContext.tsx.
import fs from "fs";
import path from "path";
const dict = fs.readFileSync("src/contexts/LanguageContext.tsx", "utf8");
const defined = new Set([...dict.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map((m) => m[1]));
const missing = new Map();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const f = path.join(d, e.name);
  if (e.isDirectory()) return walk(f);
  if (!/\.tsx?$/.test(f)) return;
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_.\-]+)["'`]\s*\)/g)) {
    if (!defined.has(m[1])) missing.set(m[1], [...(missing.get(m[1]) || []), path.relative(".", f)]);
  }
});
walk("src");
for (const [k, files] of [...missing].sort()) console.log(k, "←", [...new Set(files)].join(", "));
console.log(`${missing.size} missing keys`);
process.exit(missing.size ? 1 : 0);
