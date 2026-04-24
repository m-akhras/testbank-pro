import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function saveExam(name, versions) {
  try {
    const { data, error } = await supabase.from("exams").insert({
      name,
      versions,
      created_at: new Date().toISOString(),
    }).select();
    if (error) throw error;
    return data[0];
  } catch (e) { console.error("saveExam error:", e); return null; }
}

export async function loadExams() {
  try {
    const { data, error } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.error("loadExams error:", e); return []; }
}
