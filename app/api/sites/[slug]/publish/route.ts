import { NextResponse } from "next/server";
import { publishSite } from "@/lib/sites";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const ok = await publishSite(slug);
    if (!ok) return NextResponse.json({ error: "site not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `database unavailable: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }
}
