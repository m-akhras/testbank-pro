import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { name, email, institution } = await req.json();
    if (!name || !email || !institution) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }
    const { error } = await supabase.from("waitlist").insert({ name, email, institution });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
