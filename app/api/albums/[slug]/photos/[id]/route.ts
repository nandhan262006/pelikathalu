import { NextResponse } from "next/server";
import { deletePhoto, getPhotoUrl } from "@/lib/albums";
import { cascadeDeleteR2 } from "@/lib/media-cleanup";

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const photoId = Number(id);
  // Grab the URL first — the row (and its url) is gone after the delete.
  const url = await getPhotoUrl(photoId);
  const ok = await deletePhoto(photoId);
  if (!ok) return NextResponse.json({ error: "photo not found" }, { status: 404 });
  const cleaned = await cascadeDeleteR2(url ? [url] : [], { albumSlug: slug, photoId });
  return NextResponse.json({ ok: true, cleaned });
}
