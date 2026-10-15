import { NextResponse } from "next/server";
import { addPhotos, listPhotos, reorderPhotos } from "@/lib/albums";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return NextResponse.json({ photos: await listPhotos(slug) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls)
    ? (body!.urls as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
    : [];
  if (urls.length === 0) return NextResponse.json({ error: "urls[] required (http(s) strings)" }, { status: 400 });
  const added = await addPhotos(slug, urls);
  if (added === 0) return NextResponse.json({ error: "album not found" }, { status: 404 });
  return NextResponse.json({ ok: true, added }, { status: 201 });
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
