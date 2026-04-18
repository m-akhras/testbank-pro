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

export async function migrateCustomCourses() {
  const supabase = getClient();

  const { data: oldRows, error: oldErr } = await supabase
    .from("custom_courses")
    .select("*");
  if (oldErr) throw oldErr;
  if (!oldRows || oldRows.length === 0) return { inserted: 0, skipped: 0, total: 0 };

  const { data: existing, error: existErr } = await supabase
    .from("courses")
    .select("name");
  if (existErr) throw existErr;
  const existingNames = new Set((existing || []).map(r => r.name));

  const toInsert = oldRows
    .filter(r => !existingNames.has(r.name))
    .map(r => ({
      name: r.name,
      color: r.color || "#6366f1",
      department: null,
      textbook_name: r.textbook || null,
      textbook_author: null,
      textbook_edition: null,
      chapters: r.chapters || [],
      glossary_text: null,
      reference_images: [],
      notation_style: null,
      is_builtin: false,
      created_by: r.user_id || null,
    }));

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: oldRows.length, total: oldRows.length };
  }

  const { error: insertErr } = await supabase.from("courses").insert(toInsert);
  if (insertErr) throw insertErr;
  return { inserted: toInsert.length, skipped: oldRows.length - toInsert.length, total: oldRows.length };
}
