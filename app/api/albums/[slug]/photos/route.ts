import { NextResponse } from "next/server";
import { addPhotos, listPhotos, reorderPhotos } from "@/lib/albums";
import { normalizeImageUrl } from "@/lib/drive";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return NextResponse.json({ photos: await listPhotos(slug) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
  const raw = Array.isArray(body?.urls)
    ? (body!.urls as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim())).map((u) => u.trim())
    : [];
  if (raw.length === 0) return NextResponse.json({ error: "urls[] required (http(s) strings)" }, { status: 400 });
  // Block new Drive hotlinks — they 403/throttle and break galleries.
  // Use Drive → R2 import (copies bytes to R2) instead.
  const driveOnes = raw.filter((u) => u.includes("googleusercontent.com") || u.includes("drive.google"));
  if (driveOnes.length) {
    return NextResponse.json(
      { error: `Refusing ${driveOnes.length} Drive URL(s) — they break galleries. Use “Check Drive → Copy to R2 gallery” so files are stored permanently in R2.` },
      { status: 400 }
    );
  }
  const urls = raw.map((u) => normalizeImageUrl(u)).filter((u) => /^https?:\/\//.test(u));
  const result = await addPhotos(slug, urls);
  if (!result.albumFound) return NextResponse.json({ error: "album not found" }, { status: 404 });
  return NextResponse.json(
    {
      ok: true,
      added: result.added,
      // Which URLs actually landed — the client appends only these so its grid
      // never shows rows the server deduped away.
      urls: result.addedUrls,
      ...(result.skipped ? { skipped: result.skipped, note: `${result.skipped} URL(s) were already in this gallery` } : {}),
    },
    { status: result.added ? 201 : 200 }
  );
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids[] required" }, { status: 400 });
  const ok = await reorderPhotos(slug, ids);
  if (!ok) return NextResponse.json({ error: "album not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
