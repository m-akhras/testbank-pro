// Diagnostic + seeder for the `courses` table.
// Run with:   node --env-file=.env.local scripts/seed-courses-debug.mjs
import { createClient } from "@supabase/supabase-js";
import { COURSES } from "../lib/courses/index.js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  console.error("Run: node --env-file=.env.local scripts/seed-courses-debug.mjs");
  process.exit(1);
}

const DEPARTMENT = {
  "Calculus 1":              "Mathematics",
  "Calculus 2":              "Mathematics",
  "Calculus 3":              "Mathematics",
  "Quantitative Methods I":  "Business/Economics",
  "Quantitative Methods II": "Business/Economics",
  "Precalculus":             "Mathematics",
  "Discrete Mathematics":    "Mathematics",
};

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

console.log("== Supabase diagnostic ==");
console.log("URL:", URL);
console.log("Key prefix:", KEY.slice(0, 20) + "…");

// 1. Can we read from courses?
const readResp = await supabase.from("courses").select("id,name,is_builtin");
if (readResp.error) {
  console.error("\n❌ SELECT courses failed:", readResp.error);
  process.exit(1);
}
console.log(`\n✅ SELECT ok — ${readResp.data.length} existing rows.`);
if (readResp.data.length) {
  console.log("   existing:", readResp.data.map(r => `${r.name}${r.is_builtin ? " (builtin)" : ""}`).join(", "));
}

// 2. Try inserting one test row to reveal RLS / schema errors
const builtinNames = Object.keys(COURSES);
console.log(`\nBuilt-in modules available: ${builtinNames.join(", ")}`);

const existingNames = new Set(readResp.data.filter(r => r.is_builtin).map(r => r.name));
const toInsert = builtinNames
  .filter(n => !existingNames.has(n))
  .map(name => {
    const mod = COURSES[name];
    return {
      name,
      color: mod.color || "#6366f1",
      department: DEPARTMENT[name] || "Mathematics",
      chapters: mod.chapters || [],
      reference_images: [],
      is_builtin: true,
    };
  });

if (toInsert.length === 0) {
  console.log("\n✅ All built-in courses already present. Nothing to do.");
  process.exit(0);
}

console.log(`\n→ Inserting ${toInsert.length} rows: ${toInsert.map(r => r.name).join(", ")}`);
const insertResp = await supabase.from("courses").insert(toInsert).select();

if (insertResp.error) {
  console.error("\n❌ INSERT failed:");
  console.error("   code:", insertResp.error.code);
  console.error("   message:", insertResp.error.message);
  console.error("   details:", insertResp.error.details);
  console.error("   hint:", insertResp.error.hint);
  if (insertResp.error.code === "42501" || /row-level security/i.test(insertResp.error.message || "")) {
    console.error("\n→ This is an RLS error. In the Supabase SQL Editor, run:");
    console.error("     ALTER TABLE courses DISABLE ROW LEVEL SECURITY;");
    console.error("   Or add a permissive policy for the anon role.");
  }
  process.exit(1);
}

console.log(`\n✅ Inserted ${insertResp.data.length} rows.`);
const after = await supabase.from("courses").select("name,is_builtin").eq("is_builtin", true);
console.log(`\nFinal built-in count: ${after.data?.length ?? "?"}`);
console.log("Names:", (after.data || []).map(r => r.name).join(", "));
