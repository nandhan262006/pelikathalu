import { NextResponse } from "next/server";
import { createAlbum, listAlbums, slugify } from "@/lib/albums";

export async function GET() {
  return NextResponse.json({ albums: await listAlbums() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    slug?: string;
    couple?: string;
    description?: string;
  } | null;

  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const slug = slugify(body?.slug?.trim() || title);
  if (!slug) return NextResponse.json({ error: "could not derive a slug" }, { status: 400 });

  const result = await createAlbum({ slug, title, couple: body?.couple, description: body?.description });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ album: result }, { status: 201 });
}
