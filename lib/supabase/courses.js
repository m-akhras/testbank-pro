"use client";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function loadCourses() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("is_builtin", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getCourse(id) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCourse(course) {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  const payload = { ...course };
  if (!payload.created_by && user) payload.created_by = user.id;
  const { data, error } = await supabase
    .from("courses")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id) {
  const supabase = getClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
  return true;
}
