import { NextResponse } from "next/server";
import { addPhotos, getAlbumBySlug, listPhotos } from "@/lib/albums";
import { copyDriveFileToR2, getR2Config } from "@/lib/r2";

export const maxDuration = 120; // Hobby Fluid allows 300; 120 is headroom over the old 60

/**
 * POST /api/drive/import-to-r2
 * Body: { albumSlug: string, fileIds: string[] }
 * Downloads each Drive file server-side and stores a permanent copy in R2,
 * then attaches the R2 URLs to the album. Drive lh3 URLs are NEVER stored —
 * they are flaky (403/quota/sharing) and slow. R2 is the source of truth.
 *
 * Keep batches small from the client (4-6 ids per call, 3 batches in parallel)
 * so no request times out on 10-20MB wedding files. Concurrency inside is 4.
 * Files already in the gallery (matched by Drive-id tag in the R2 key) are
 * skipped, so retrying a failed batch never creates duplicates.
 */
export async function POST(req: Request) {
  const r2 = getR2Config();
  if (!r2) return NextResponse.json({ error: "R2 env not configured" }, { status: 500 });
  if (!process.env.DRIVE_API_KEY) return NextResponse.json({ error: "DRIVE_API_KEY not configured" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { albumSlug?: unknown; fileIds?: unknown } | null;
  const albumSlug = typeof body?.albumSlug === "string" ? body.albumSlug.trim() : "";
  const fileIds = Array.isArray(body?.fileIds)
    ? (body!.fileIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[\w-]{10,}$/.test(x.trim())).map((x) => x.trim())
    : [];

  if (!albumSlug) return NextResponse.json({ error: "albumSlug required" }, { status: 400 });
  if (!fileIds.length) return NextResponse.json({ error: "fileIds[] required (Drive file ids)" }, { status: 400 });
  if (fileIds.length > 20) return NextResponse.json({ error: "max 20 fileIds per request — send smaller batches" }, { status: 400 });

  const album = await getAlbumBySlug(albumSlug);
  if (!album) return NextResponse.json({ error: "album not found" }, { status: 404 });

  // Resume-safe: R2 keys embed the Drive id (…-<8-char-id>.ext), so ids whose
  // copies are already attached are skipped instead of duplicated.
  const existing = await listPhotos(albumSlug);
  const alreadyThere = (id: string) => {
    const tag = `-${id.slice(0, 8)}.`;
    return existing.some((p) => p.url.includes("/drive/") && p.url.includes(tag));
  };
  const skipped = fileIds.filter((id) => alreadyThere(id));
  const fresh = fileIds.filter((id) => !alreadyThere(id));

  if (!fresh.length) {
    return NextResponse.json(
      {
        ok: true,
        albumSlug,
        imported: [],
        failed: [],
        skipped,
        added: 0,
        note: "All of these are already in the gallery — nothing to copy.",
      },
      { status: 200 }
    );
  }

  const imported: { driveId: string; r2Url: string; name: string }[] = [];
  const failed: { driveId: string; error: string }[] = [];

  // Concurrency 4 — with 3 parallel client batches that's ≤12 streams overall,
  // still modest for Drive API-key quota while keeping a 6-id batch well inside 120s.
  const CONC = 4;
  for (let i = 0; i < fresh.length; i += CONC) {
    const chunk = fresh.slice(i, i + CONC);
    const results = await Promise.all(
      chunk.map(async (driveId) => {
        try {
          const { r2Url, name } = await copyDriveFileToR2(driveId, albumSlug);
          return { ok: true as const, driveId, r2Url, name };
        } catch (e) {
          return { ok: false as const, driveId, error: e instanceof Error ? e.message : "copy failed" };
        }
      })
    );
    for (const r of results) {
      if (r.ok) imported.push({ driveId: r.driveId, r2Url: r.r2Url, name: r.name });
      else failed.push({ driveId: r.driveId, error: r.error });
    }
  }

  if (imported.length) {
    const attach = await addPhotos(albumSlug, imported.map((x) => x.r2Url));
    if (!attach.albumFound) return NextResponse.json({ error: "album not found" }, { status: 404 });
    if (!attach.added) {
      // Copies exist in R2 but nothing attached — surface a retry hint instead
      // of a silent no-op.
      return NextResponse.json(
        {
          ok: false,
          albumSlug,
          imported: [],
          failed,
          skipped,
          added: 0,
          error: "Copies were made but attaching failed — click Copy again (already-copied files are skipped).",
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      albumSlug,
      imported,
      failed,
      skipped,
      added: imported.length,
      note: imported.length
        ? "Stored permanent R2 copies — Drive links are not kept."
        : "Nothing imported. Check that Drive files are shared Anyone with the link → Viewer.",
    },
    { status: imported.length || skipped.length ? (imported.length ? 201 : 200) : 502 }
  );
}
