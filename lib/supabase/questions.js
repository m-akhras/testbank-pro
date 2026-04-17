"use client";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function loadBank() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(r => ({ ...r.data, id: r.id, createdAt: new Date(r.created_at).getTime() }));
  } catch (e) { console.error("loadBank error:", e); return []; }
}

export async function saveQuestion(q) {
  try {
    const supabase = getClient();
    const { error } = await supabase.from("questions").upsert({
      id: q.id,
      course: q.course,
      section: q.section,
      type: q.type,
      difficulty: q.difficulty,
      data: q,
    });
    if (error) throw error;
  } catch (e) { console.error("saveQuestion error:", e); }
}

export async function deleteQuestion(id) {
  try {
    const supabase = getClient();
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  } catch (e) { console.error("deleteQuestion error:", e); }
}
