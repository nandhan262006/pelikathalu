import { NextResponse } from "next/server";
import { AwsV4Signer } from "aws4fetch";

const ALLOWED: Record<string, { ext: string; prefix: string }> = {
  "image/jpeg": { ext: "jpg", prefix: "images/uploads" },
  "image/png": { ext: "png", prefix: "images/uploads" },
  "image/webp": { ext: "webp", prefix: "images/uploads" },
  "image/gif": { ext: "gif", prefix: "images/uploads" },
  "image/avif": { ext: "avif", prefix: "images/uploads" },
  "image/bmp": { ext: "bmp", prefix: "images/uploads" },
  "image/heic": { ext: "heic", prefix: "images/uploads" },
  "image/heif": { ext: "heif", prefix: "images/uploads" },
  "image/heic-sequence": { ext: "heic", prefix: "images/uploads" },
  "image/heif-sequence": { ext: "heif", prefix: "images/uploads" },
  "image/tiff": { ext: "tif", prefix: "images/uploads" },
  "image/svg+xml": { ext: "svg", prefix: "images/uploads" },
  "video/mp4": { ext: "mp4", prefix: "videos/uploads" },
  "video/quicktime": { ext: "mov", prefix: "videos/uploads" },
  "video/webm": { ext: "webm", prefix: "videos/uploads" },
};

// Browsers often report "" for HEIC/DNG/RAW from Windows/phones — guess from filename.
const EXT_FALLBACK: Record<string, { ext: string; prefix: string; contentType: string }> = {
  jpg: { ext: "jpg", prefix: "images/uploads", contentType: "image/jpeg" },
  jpeg: { ext: "jpg", prefix: "images/uploads", contentType: "image/jpeg" },
  png: { ext: "png", prefix: "images/uploads", contentType: "image/png" },
  webp: { ext: "webp", prefix: "images/uploads", contentType: "image/webp" },
  gif: { ext: "gif", prefix: "images/uploads", contentType: "image/gif" },
  avif: { ext: "avif", prefix: "images/uploads", contentType: "image/avif" },
  bmp: { ext: "bmp", prefix: "images/uploads", contentType: "image/bmp" },
  heic: { ext: "heic", prefix: "images/uploads", contentType: "image/heic" },
  heif: { ext: "heif", prefix: "images/uploads", contentType: "image/heif" },
  tif: { ext: "tif", prefix: "images/uploads", contentType: "image/tiff" },
  tiff: { ext: "tif", prefix: "images/uploads", contentType: "image/tiff" },
  svg: { ext: "svg", prefix: "images/uploads", contentType: "image/svg+xml" },
  dng: { ext: "dng", prefix: "images/uploads", contentType: "image/dng" },
  mp4: { ext: "mp4", prefix: "videos/uploads", contentType: "video/mp4" },
  mov: { ext: "mov", prefix: "videos/uploads", contentType: "video/quicktime" },
  webm: { ext: "webm", prefix: "videos/uploads", contentType: "video/webm" },
};

export async function POST(req: Request) {
  const { contentType, filename } = (await req.json().catch(() => ({}))) as {
    contentType?: string;
    filename?: string;
  };

  let type = ALLOWED[contentType ?? ""];
  let effectiveType = contentType ?? "";
  if (!type) {
    // Fall back to extension so folder drops with HEIC / empty mime still upload.
    const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";
    const fb = EXT_FALLBACK[ext];
    if (fb) {
      type = { ext: fb.ext, prefix: fb.prefix };
      effectiveType = fb.contentType;
    }
  }
  if (!type) {
    return NextResponse.json({ error: `unsupported contentType (${contentType})` }, { status: 400 });
  }

  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBase = process.env.NEXT_PUBLIC_R2_URL;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) {
    return NextResponse.json({ error: "R2 env not configured" }, { status: 500 });
  }

  const safe =
    (filename ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file";
  const key = `${type.prefix}/${Date.now()}-${safe}.${type.ext}`;

  const signer = new AwsV4Signer({
    method: "PUT",
    url: `${endpoint}/${bucket}/${key}`,
    headers: { "content-type": effectiveType },
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
  });

  const { url } = await signer.sign();

  return NextResponse.json({
    uploadUrl: url.toString(),
    key,
    publicUrl: `${publicBase}/${key}`,
    contentType: effectiveType,
  });
}
