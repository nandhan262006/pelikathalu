import { NextResponse } from "next/server";
import { getSiteContent, saveDraft } from "@/lib/sites";
import { defaultContent, type SiteContent } from "@/lib/content";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const content = await getSiteContent(slug, true);
    if (!content) return NextResponse.json({ error: "site not found" }, { status: 404 });
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: `database unavailable: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  if (!body?.content || typeof body.content !== "object") {
    return NextResponse.json({ error: "body must be { content: {...} }" }, { status: 400 });
  }
  if (!looksLikeSiteContent(body.content as Record<string, unknown>)) {
    return NextResponse.json({ error: "content missing required top-level keys" }, { status: 422 });
  }
  try {
    const ok = await saveDraft(slug, body.content as SiteContent);
    if (!ok) return NextResponse.json({ error: "site not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `database unavailable: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }
}

function looksLikeSiteContent(c: Record<string, unknown>): boolean {
  const required = Object.keys(defaultContent);
  return required.every((k) => k in c);
}
