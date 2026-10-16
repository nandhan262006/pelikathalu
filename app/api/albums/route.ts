import { NextResponse } from "next/server";
import { createAlbum, listAlbums, slugify } from "@/lib/albums";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const featuredOnly = searchParams.get("featured") === "1";
  const hideEmpty = searchParams.get("nonempty") === "1";
  const cat = category === "portrait" || category === "wedding" ? category : undefined;
  return NextResponse.json({ albums: await listAlbums({ category: cat, featuredOnly: featuredOnly || undefined, hideEmpty: hideEmpty || undefined }) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    slug?: string;
    couple?: string;
    description?: string;
    category?: string;
    featured?: boolean;
  } | null;

  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const slug = slugify(body?.slug?.trim() || title);
  if (!slug) return NextResponse.json({ error: "could not derive a slug" }, { status: 400 });

  const category = body?.category === "portrait" ? "portrait" : "wedding";
  const result = await createAlbum({
    slug,
    title,
    couple: body?.couple,
    description: body?.description,
    category,
    featured: !!body?.featured,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ album: result }, { status: 201 });
}
