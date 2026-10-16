import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAlbumBySlug } from "@/lib/albums";
import { copyDriveFileToR2, extractDriveId, getR2Config } from "@/lib/r2";

export const maxDuration = 60;

/**
 * POST /api/albums/[slug]/migrate-to-r2
 * Finds photos in this album still pointing at Drive (lh3/thumbnail/share URLs),
 * copies each file's bytes into R2, and rewrites the photo row to the R2 URL.
 * Body: { limit?: number } (default 10, max 20 per call — call repeatedly).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r2 = getR2Config();
  if (!r2) return NextResponse.json({ error: "R2 env not configured" }, { status: 500 });

  const album = await getAlbumBySlug(slug);
  if (!album) return NextResponse.json({ error: "album not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
  const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 20);

  const db = getDb();
  const rows = await db.execute({
    sql: `SELECT id, url FROM photos WHERE album_id = ? AND (url LIKE '%googleusercontent%' OR url LIKE '%drive.google%') ORDER BY sort, id LIMIT ?`,
    args: [album.id, limit],
  });

  const migrated: { photoId: number; r2Url: string; name: string }[] = [];
  const failed: { photoId: number; error: string }[] = [];
  let remaining = 0;

  for (const row of rows.rows) {
    const photoId = Number(row.id);
    const url = String(row.url);
    const driveId = extractDriveId(url);
    if (!driveId) {
      failed.push({ photoId, error: "could not parse Drive id from stored URL" });
      continue;
    }
    try {
      const { r2Url, name } = await copyDriveFileToR2(driveId, slug);
      await db.execute({ sql: "UPDATE photos SET url = ? WHERE id = ?", args: [r2Url, photoId] });
      migrated.push({ photoId, r2Url, name });
    } catch (e) {
      failed.push({ photoId, error: e instanceof Error ? e.message : "migrate failed" });
    }
  }

  const left = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM photos WHERE album_id = ? AND (url LIKE '%googleusercontent%' OR url LIKE '%drive.google%')`,
    args: [album.id],
  });

  remaining = Number(left.rows[0].c);
  return NextResponse.json({ ok: true, migrated, failed, remaining, migratedCount: migrated.length });
}
