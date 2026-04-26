"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { makeStyles, text1, text2, text3, border, bg1, bg2, green1 } from "../../../lib/theme.js";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const S = makeStyles(green1);
  const accent = green1;

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [universityName, setUniversityName] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setUniversityName(data.university_name || "");
        setInstructorName(data.instructor_name || "");
        setLogoUrl(data.university_logo_url || "");
      }
      setLoading(false);
    })();
  }, [router]);

  function pickLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setMessage({ type: "error", text: "Logo must be a PNG file." });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setMessage(null);
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setMessage(null);
    const supabase = getSupabase();

    let nextLogoUrl = logoUrl;
    if (logoFile) {
      const path = `${userId}.png`;
      const { error: upErr } = await supabase.storage
        .from("user-logos")
        .upload(path, logoFile, { upsert: true, contentType: "image/png" });
      if (upErr) {
        setMessage({ type: "error", text: "Logo upload failed: " + upErr.message });
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from("user-logos").getPublicUrl(path);
      // append cache-buster so the new logo shows immediately after re-upload
      nextLogoUrl = pub.publicUrl + `?t=${Date.now()}`;
      setLogoUrl(nextLogoUrl);
      setLogoFile(null);
      setLogoPreview("");
    }

    const { error: dbErr } = await supabase.from("user_settings").upsert({
      user_id: userId,
      university_name: universityName,
      instructor_name: instructorName,
      university_logo_url: nextLogoUrl,
      updated_at: new Date().toISOString(),
    });
    if (dbErr) {
      setMessage({ type: "error", text: "Save failed: " + dbErr.message });
    } else {
      setMessage({ type: "success", text: "Settings saved ✓" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ color: text2, fontSize: "0.85rem" }}>Loading settings…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Settings</h1>
        <p style={S.sub}>Per-user Word export template — appears on cover pages and headers.</p>
      </div>

      <div style={{ ...S.card, maxWidth: "640px", padding: "1.5rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: "600", color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
          Word Export Template
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.78rem", color: text2, marginBottom: "0.35rem", fontWeight: "500" }}>
            University name
          </label>
          <input
            type="text"
            value={universityName}
            onChange={e => setUniversityName(e.target.value)}
            placeholder="e.g. Lebanese American University"
            style={{ ...S.input, width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.78rem", color: text2, marginBottom: "0.35rem", fontWeight: "500" }}>
            Instructor name
          </label>
          <input
            type="text"
            value={instructorName}
            onChange={e => setInstructorName(e.target.value)}
            placeholder="e.g. Dr. Mohammad Akhras"
            style={{ ...S.input, width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.78rem", color: text2, marginBottom: "0.35rem", fontWeight: "500" }}>
            University logo (PNG)
          </label>
          {(logoPreview || logoUrl) && (
            <div style={{ marginBottom: "0.6rem", padding: "0.75rem", background: bg2, border: "1px solid " + border, borderRadius: "6px", display: "inline-block" }}>
              <img
                src={logoPreview || logoUrl}
                alt="Logo preview"
                style={{ maxHeight: "100px", maxWidth: "240px", display: "block" }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/png"
            onChange={pickLogo}
            style={{ display: "block", fontSize: "0.78rem", color: text2 }}
          />
          <div style={{ fontSize: "0.7rem", color: text3, marginTop: "0.25rem" }}>
            PNG only. Stored in Supabase Storage as <code>user-logos/{userId}.png</code>.
          </div>
        </div>

        {message && (
          <div style={{
            padding: "0.6rem 0.85rem",
            background: message.type === "error" ? "#7f1d1d33" : "#14532d33",
            border: "1px solid " + (message.type === "error" ? "#f87171" : "#4ade80"),
            color: message.type === "error" ? "#f87171" : "#4ade80",
            borderRadius: "6px",
            fontSize: "0.78rem",
            marginBottom: "1rem",
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ ...S.btn(accent, saving), fontSize: "0.85rem", padding: "0.5rem 1.25rem" }}
          >
            {saving ? "Saving…" : "💾 Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
