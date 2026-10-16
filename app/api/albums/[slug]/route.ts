import { NextResponse } from "next/server";
import { getAlbumBySlug, listPhotos, updateAlbum, deleteAlbum } from "@/lib/albums";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) return NextResponse.json({ error: "album not found" }, { status: 404 });
  const photos = await listPhotos(slug);

  const db = getDb();
  const rows = await db.execute({ sql: "SELECT * FROM albums WHERE id = ?", args: [album.id] });

  return NextResponse.json({ album: rows.rows[0], photos: photos.map((p) => p.url) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    couple?: string;
    description?: string;
    cover?: string | null;
    category?: string;
    featured?: boolean;
  } | null;
  if (
    !body ||
    (!body.title &&
      !body.couple &&
      body.description === undefined &&
      body.cover === undefined &&
      body.category === undefined &&
      body.featured === undefined)
  ) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const patch: { title?: string; couple?: string; description?: string; cover?: string | null; category?: "wedding" | "portrait"; featured?: boolean } = {
    title: body.title,
    couple: body.couple,
    description: body.description,
    cover: body.cover,
    featured: body.featured,
  };
  if (body.category !== undefined) {
    if (body.category !== "wedding" && body.category !== "portrait")
      return NextResponse.json({ error: "bad category" }, { status: 400 });
    patch.category = body.category;
  }
  const ok = await updateAlbum(slug, patch);
  if (!ok) return NextResponse.json({ error: "album not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ok = await deleteAlbum(slug);
  if (!ok) return NextResponse.json({ error: "album not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
