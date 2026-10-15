import { NextResponse } from "next/server";
import { AwsV4Signer } from "aws4fetch";

const ALLOWED: Record<string, { ext: string; prefix: string }> = {
  "image/jpeg": { ext: "jpg", prefix: "images/uploads" },
  "image/png": { ext: "png", prefix: "images/uploads" },
  "image/webp": { ext: "webp", prefix: "images/uploads" },
  "video/mp4": { ext: "mp4", prefix: "videos/uploads" },
  "video/quicktime": { ext: "mov", prefix: "videos/uploads" },
};

export async function POST(req: Request) {
  const { contentType, filename } = (await req.json().catch(() => ({}))) as {
    contentType?: string;
    filename?: string;
  };

  const type = ALLOWED[contentType ?? ""];
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
    headers: { "content-type": contentType! },
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
  });
}
