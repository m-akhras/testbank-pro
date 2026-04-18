// Probe which columns the `courses` table actually has in Supabase.
// Inserts each column one at a time and records which ones error out.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const CANDIDATE_COLS = {
  name: "__probe__",
  color: "#000000",
  department: "x",
  textbook: "x",
  textbook_name: "x",
  textbook_author: "x",
  textbook_edition: "x",
  chapters: [],
  glossary_text: "x",
  reference_images: [],
  notation_style: "x",
  is_builtin: false,
  user_id: null,
  created_by: null,
};

const missing = [];
const present = [];

for (const [col, val] of Object.entries(CANDIDATE_COLS)) {
  const row = { name: `__probe_${col}__` };
  if (col !== "name") row[col] = val;
  const { error } = await supabase.from("courses").insert(row).select();
  if (error) {
    if (/Could not find the .* column/.test(error.message)) {
      missing.push(col);
    } else {
      // schema has the column but insert was rejected for another reason
      present.push(col);
      console.log(`  ${col}: present (other error: ${error.message})`);
    }
  } else {
    present.push(col);
    // clean up probe row
    await supabase.from("courses").delete().eq("name", `__probe_${col}__`);
  }
}

console.log("\n== Schema probe ==");
console.log("Present columns:", present.join(", ") || "(none reachable)");
console.log("Missing columns:", missing.join(", ") || "(none)");
