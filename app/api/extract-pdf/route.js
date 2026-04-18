import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { base64, filename } = await request.json();
    if (!base64) {
      return NextResponse.json({ error: "Missing base64 data" }, { status: 400 });
    }
    const buffer = Buffer.from(base64, "base64");
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return NextResponse.json({ text: result.text || "", filename: filename || null });
  } catch (e) {
    console.error("extract-pdf error:", e);
    return NextResponse.json({ error: e.message || "PDF parse failed" }, { status: 500 });
  }
}
