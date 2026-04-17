"use client";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function loadExams() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .or("is_master.is.null,is_master.eq.false")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error("loadExams error:", e); return []; }
}

export async function saveExam(name, versions) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("exams")
      .insert({ name, versions, created_at: new Date().toISOString() })
      .select();
    if (error) throw error;
    return data[0];
  } catch (e) { console.error("saveExam error:", e); return null; }
}

export async function loadMasters() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("exams")
      .select("id, name, master_questions, settings, created_at")
      .eq("is_master", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error("loadMasters error:", e); return []; }
}

export async function saveMaster(name, masterQuestions, settings) {
  try {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("exams")
      .insert({
        name,
        is_master: true,
        versions: [],
        master_questions: masterQuestions,
        settings,
        user_id: user?.id,
        created_at: new Date().toISOString(),
      })
      .select();
    if (error) throw error;
    return data[0];
  } catch (e) { console.error("saveMaster error:", e); return null; }
}

export async function deleteMaster(id) {
  try {
    const supabase = getClient();
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) { console.error("deleteMaster error:", e); return false; }
}

export async function logExport(examName, format, versionLabel) {
  try {
    const supabase = getClient();
    await supabase.from("export_history").insert({
      exam_name: examName,
      format,
      version_label: versionLabel,
      exported_at: new Date().toISOString(),
    });
  } catch (e) { console.error("logExport error:", e); }
}

export async function loadExportHistory() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("export_history")
      .select("*")
      .order("exported_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  } catch (e) { console.error("loadExportHistory error:", e); return []; }
}
