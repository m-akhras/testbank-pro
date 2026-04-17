"use client";
import { createBrowserClient } from "@supabase/ssr";
import { COURSES } from "../courses/index.js";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Inferred department tag per built-in course
const DEPARTMENT = {
  "Calculus 1":              "Mathematics",
  "Calculus 2":              "Mathematics",
  "Calculus 3":              "Mathematics",
  "Quantitative Methods I":  "Business/Economics",
  "Quantitative Methods II": "Business/Economics",
  "Precalculus":             "Mathematics",
  "Discrete Mathematics":    "Mathematics",
};

export async function seedBuiltinCourses() {
  const supabase = getClient();

  const { data: existing, error: loadErr } = await supabase
    .from("courses")
    .select("name")
    .eq("is_builtin", true);
  if (loadErr) throw loadErr;
  const existingNames = new Set((existing || []).map(r => r.name));

  const rows = Object.entries(COURSES)
    .filter(([name]) => !existingNames.has(name))
    .map(([name, mod]) => ({
      name,
      color: mod.color || "#6366f1",
      department: DEPARTMENT[name] || "Mathematics",
      textbook_name: null,
      textbook_author: null,
      textbook_edition: null,
      chapters: mod.chapters || [],
      glossary_text: null,
      reference_images: [],
      notation_style: null,
      is_builtin: true,
    }));

  if (rows.length === 0) return { inserted: 0, skipped: existingNames.size };

  const { error: insertErr } = await supabase.from("courses").insert(rows);
  if (insertErr) throw insertErr;
  return { inserted: rows.length, skipped: existingNames.size };
}
