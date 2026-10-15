import { NextResponse } from "next/server";
import { deletePhoto } from "@/lib/albums";

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
  const ok = await deletePhoto(Number(id));
  if (!ok) return NextResponse.json({ error: "photo not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
