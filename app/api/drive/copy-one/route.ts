import { NextResponse } from "next/server";
import { copyDriveFileToR2, extractDriveId, getR2Config } from "@/lib/r2";

export const maxDuration = 120;

/**
 * POST /api/drive/copy-one  { url }
 * Copies ONE public Drive file (image or video/reel) into permanent R2 storage
 * and returns its publicUrl. No Turso, no album attach anything — the caller
 * stores the URL wherever it belongs (e.g. a reel src in site content).
 * Key lands under images/drive/reels|videos/drive/reels so cascade-delete rules
 * treat it as dashboard-managed.
 */
export async function POST(req: Request) {
  if (!getR2Config()) return NextResponse.json({ error: "R2 env not configured" }, { status: 500 });
  if (!process.env.DRIVE_API_KEY) return NextResponse.json({ error: "DRIVE_API_KEY not configured" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  const id = extractDriveId(raw);
  if (!id) return NextResponse.json({ error: "url required — paste a public Drive file link or id" }, { status: 400 });

  try {
    const { r2Url, name, bytes } = await copyDriveFileToR2(id, "reels");
    return NextResponse.json({ ok: true, publicUrl: r2Url, name, bytes }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "copy failed";
    if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("access denied") || msg.includes("Anyone")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
