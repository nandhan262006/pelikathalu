import { NextResponse } from "next/server";
import { deleteR2Object, getR2Config, mediumBytes, parseManagedR2Key, uploadBufferToR2 } from "@/lib/r2";
import { AwsClient } from "aws4fetch";

export const maxDuration = 60;

/**
 * POST /api/r2/convert  { url }
 * Browser uploads land as HEIC/TIFF bytes straight in R2 (raw PUT). Chrome and
 * Firefox cannot display those, so the admin converts them to display JPEG.
 * Downloads the object, recompresses via sharp (≤2000px, q82), writes a .jpg
 * sibling, deletes the original, and returns the new public URL.
 */
export async function POST(req: Request) {
  const cfg = getR2Config();
  if (!cfg) return NextResponse.json({ error: "R2 env not configured" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const key = parseManagedR2Key(url, cfg);
  if (!key) return NextResponse.json({ error: "not a managed R2 object" }, { status: 400 });

  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const get = await client.fetch(`${cfg.endpoint}/${cfg.bucket}/${key}`);
  if (!get.ok) return NextResponse.json({ error: `object not found (${get.status})` }, { status: 404 });

  const contentType = get.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const buf = new Uint8Array(await get.arrayBuffer());
  if (buf.length < 1024) return NextResponse.json({ error: "object too small to convert" }, { status: 422 });

  // Only formats browsers can't display need converting — the rest pass through.
  const convertible = /(^image\/(heic|heif)(-sequence)?$)|(^image\/tiff$)/i.test(contentType);
  if (!convertible) {
    return NextResponse.json({ ok: true, publicUrl: `${cfg.publicBase}/${key}`, converted: false });
  }

  const medium = await mediumBytes(buf, contentType);
  if (!medium) return NextResponse.json({ error: "could not decode this HEIC/TIFF with sharp" }, { status: 422 });

  const newKey = key.replace(/\.[a-z0-9]{2,5}$/i, ".jpg");
  const publicUrl = await uploadBufferToR2({
    key: newKey,
    body: medium.body,
    contentType: "image/jpeg",
  });
  if (newKey !== key) await deleteR2Object(key, cfg);

  return NextResponse.json({ ok: true, publicUrl, converted: true });
}
