import { AwsClient, AwsV4Signer } from "aws4fetch";
import sharp from "sharp";

export type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
};

export function getR2Config(): R2Config | null {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBase = process.env.NEXT_PUBLIC_R2_URL;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, publicBase };
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function extForMime(mime: string, fallbackName = ""): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(fallbackName)?.[1]?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.startsWith("image/")) return "jpg";
  return "bin";
}

export function safeBase(name: string): string {
  const s = (name || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "photo";
}

/** R2 object key for a Drive import: images/drive/<album>/<ts>-<safe>-<shortId>.<ext> */
export function buildDriveKey(albumSlug: string, driveId: string, filename: string, mime: string): string {
  const slug = (albumSlug || "album").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "album";
  const ext = extForMime(mime, filename);
  const prefix = mime.startsWith("video/") ? "videos/drive" : "images/drive";
  return `${prefix}/${slug}/${Date.now()}-${safeBase(filename)}-${driveId.slice(0, 8)}.${ext}`;
}

/** Presigned PUT URL (for browser direct uploads — existing flow). */
export async function presignedPutUrl(contentType: string, key: string) {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 env not configured");
  const signer = new AwsV4Signer({
    method: "PUT",
    url: `${cfg.endpoint}/${cfg.bucket}/${key}`,
    headers: { "content-type": contentType },
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
  });
  const { url } = await signer.sign();
  return { uploadUrl: url.toString(), publicUrl: `${cfg.publicBase}/${key}` };
}

/** Server-side upload of a buffer to R2 (used by Drive → R2 copy). */
export async function uploadBufferToR2(opts: {
  key: string;
  body: Uint8Array | Buffer | ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 env not configured");
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const url = `${cfg.endpoint}/${cfg.bucket}/${opts.key}`;
  const buf = opts.body instanceof Uint8Array ? opts.body as Uint8Array<ArrayBuffer> : new Uint8Array(opts.body as ArrayBuffer);
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "content-type": opts.contentType, "content-length": String(buf.byteLength) },
    // aws4fetch signs body hash; pass a fresh copy
    body: buf as unknown as BodyInit,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`R2 PUT ${res.status} ${t.slice(0, 200)}`);
  }
  return `${cfg.publicBase}/${opts.key}`;
}

/** Object prefixes this dashboard creates. Pre-existing assets (e.g. images/web/*) are never auto-deleted. */
const MANAGED_PREFIXES = /^(images\/uploads|videos\/uploads|images\/drive|videos\/drive)\//;

/** Map a public R2 URL to its object key — only for dashboard-managed prefixes, else null. */
export function parseManagedR2Key(url: string, cfg?: R2Config | null): string | null {
  const c = cfg ?? getR2Config();
  if (!c || !url) return null;
  try {
    const clean = url.split("?")[0];
    const base = `${c.publicBase}/`;
    if (!clean.startsWith(base)) return null;
    const rawKey = clean.slice(base.length);
    let key: string;
    try {
      key = decodeURIComponent(rawKey);
    } catch {
      key = rawKey;
    }
    return MANAGED_PREFIXES.test(key) ? key : null;
  } catch {
    return null;
  }
}

/** Delete one R2 object by key (cascade deletes). 404 counts as success. */
export async function deleteR2Object(key: string, cfg?: R2Config): Promise<boolean> {
  const c = cfg ?? getR2Config();
  if (!c) return false;
  const client = new AwsClient({
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  try {
    const res = await client.fetch(`${c.endpoint}/${c.bucket}/${key}`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Google Drive helpers (server only — needs DRIVE_API_KEY)
// ---------------------------------------------------------------------------

export type DriveImageMeta = {
  id: string;
  name: string;
  mimeType: string;
  thumb: string;
  url: string; // legacy lh3 url (kept for preview only — do NOT store)
};

function driveKey(): string | null {
  return process.env.DRIVE_API_KEY || null;
}

/** Extract a Drive file id from stored lh3 / thumbnail / share URLs (for migration). */
export function extractDriveId(input: string): string | null {
  const s = input.trim();
  let m = /lh3\.googleusercontent\.com\/d\/([\w-]{10,})/.exec(s);
  if (m) return m[1];
  m = /[?&]id=([\w-]{10,})/.exec(s);
  if (m && (s.includes("drive.google") || s.includes("googleusercontent"))) return m[1];
  m = /\/file\/d\/([\w-]{10,})/.exec(s);
  if (m) return m[1];
  if (/^[\w-]{25,}$/.test(s)) return s;
  return null;
}

export async function driveFileMeta(
  id: string,
  key?: string
): Promise<{ id: string; name: string; mimeType: string; size?: string } | null> {
  const k = key ?? driveKey();
  if (!k) throw new Error("DRIVE_API_KEY not configured");
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size&key=${encodeURIComponent(k)}`,
    { cache: "no-store" }
  );
  if (!r.ok) return null;
  return (await r.json()) as { id: string; name: string; mimeType: string; size?: string };
}

/** Download raw bytes for a public Drive file. Tries Drive API alt=media first, then lh3/uc fallbacks. */
export async function downloadDriveBytes(
  id: string,
  key?: string
): Promise<{ bytes: Uint8Array; contentType: string; name: string }> {
  const k = key ?? driveKey();
  if (!k) throw new Error("DRIVE_API_KEY not configured");

  // Meta and download are independent — fire both at once and merge (saves a
  // serial Drive roundtrip per file; meta is only used for validation/name/mime).
  const metaP = driveFileMeta(id, k);
  const mediaP = fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(k)}`
  );
  const [meta, media] = await Promise.all([metaP, mediaP]);

  if (!meta)
    throw new Error("Drive file not found or not public (share → Anyone with the link → Viewer; or API quota hit — wait a minute and resume)");
  if (meta.mimeType === "application/vnd.google-apps.folder")
    throw new Error(`"${meta.name}" is a folder, not an image — use a folder link instead`);
  if (!meta.mimeType.startsWith("image/") && !meta.mimeType.startsWith("video/"))
    throw new Error(`"${meta.name}" is ${meta.mimeType}, not an image`);

  const size = meta.size ? Number(meta.size) : 0;
  if (size > 60 * 1024 * 1024) throw new Error(`"${meta.name}" is ${(size / 1048576).toFixed(0)}MB — over 60MB limit`);

  // 1) Official API download — most reliable for public files + API key
  let r = media;
  if (!r.ok) {
    // 2) Keyless CDN fallbacks (work when file is truly "Anyone with link")
    r = await fetch(`https://lh3.googleusercontent.com/d/${id}=w4000`);
    if (!r.ok) r = await fetch(`https://drive.google.com/uc?id=${encodeURIComponent(id)}&export=download`);
  }
  if (!r.ok) throw new Error(`Drive download failed (${r.status}) — re-share as Anyone with the link → Viewer`);
  const contentType = r.headers.get("content-type")?.split(";")[0]?.trim() || meta.mimeType;
  // The keyless CDN fallbacks can return an HTML page (sign-in / virus-scan
  // interstitial) instead of bytes — storing that would corrupt the gallery.
  // Some CDNs also report a generic mime, so trust Drive's own metadata too.
  const isMedia = (t: string) => t.startsWith("image/") || t.startsWith("video/");
  if (!isMedia(contentType) && !isMedia(meta.mimeType)) {
    throw new Error(
      `Drive returned "${contentType}" instead of the file — it is probably not public. Share → Anyone with the link → Viewer`
    );
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 1024) throw new Error(`Drive returned only ${buf.length} bytes — file not public?`);
  return { bytes: buf, contentType, name: meta.name };
}

/**
 * Web "medium" for gallery display: longest edge ≤2000px, JPEG q82, EXIF-safe
 * orientation. Returns the recompressed bytes (content-type image/jpeg), or
 * null when the format can't be decoded / is a video — caller keeps original.
 */
export async function mediumBytes(
  bytes: Uint8Array,
  contentType: string
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!contentType.startsWith("image/")) return null;
  try {
    const out = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate() // bake EXIF orientation into pixels
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (out.length < 1024) return null;
    return { body: new Uint8Array(out), contentType: "image/jpeg" };
  } catch {
    // Undecodable format (e.g. some RAWs) — keep the original bytes.
    return null;
  }
}

/** Copy one Drive file straight into R2. Returns the permanent R2 public URL. */
export async function copyDriveFileToR2(driveId: string, albumSlug: string, key?: string): Promise<{ r2Url: string; name: string; bytes: number }> {
  const { bytes, contentType, name } = await downloadDriveBytes(driveId, key);
  const medium = await mediumBytes(bytes, contentType);
  const body = medium?.body ?? bytes;
  const finalType = medium?.contentType ?? contentType;
  const r2Key = buildDriveKey(albumSlug, driveId, name, finalType);
  const r2Url = await uploadBufferToR2({ key: r2Key, body, contentType: finalType });
  return { r2Url, name, bytes: body.length };
}

/**
 * Recursively list images inside a Drive folder (BFS, follows subfolders).
 * Old code skipped subfolders — wedding folders are almost always nested
 * (Haldi / Wedding / Reception), so that returned "0 images".
 */
export async function listDriveFolderRecursive(
  folderId: string,
  key?: string,
  opts?: { maxFiles?: number; maxFolders?: number; maxDepth?: number }
): Promise<{ files: DriveImageMeta[]; foldersSeen: number; truncated: boolean }> {
  const k = key ?? driveKey();
  if (!k) throw new Error("DRIVE_API_KEY not configured");
  const maxFiles = opts?.maxFiles ?? 1000;
  const maxFolders = opts?.maxFolders ?? 50;
  const maxDepth = opts?.maxDepth ?? 4;

  const { driveImageUrl, driveThumbUrl } = await import("./drive");
  const files: DriveImageMeta[] = [];
  const queue: { id: string; depth: number }[] = [{ id: folderId, depth: 0 }];
  const seen = new Set<string>([folderId]);
  let foldersSeen = 0;
  let truncated = false;

  while (queue.length && files.length < maxFiles && foldersSeen < maxFolders) {
    const { id: fid, depth } = queue.shift()!;
    foldersSeen++;
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      if (files.length >= maxFiles) { truncated = true; break; }
      const q = `'${fid}' in parents and trashed = false`;
      const u =
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
        `&fields=files(id,name,mimeType),nextPageToken&key=${encodeURIComponent(k)}` +
        `&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) {
        if (r.status === 404) throw new Error("Folder not found — check the link");
        if (r.status === 403 || r.status === 401)
          throw new Error("Drive says access denied — set Share → Anyone with the link → Viewer");
        const t = await r.text().catch(() => "");
        throw new Error(`Drive API error (${r.status}) ${t.slice(0, 160)}`);
      }
      const d = (await r.json()) as { files?: { id: string; name: string; mimeType: string }[]; nextPageToken?: string };
      for (const f of d.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          if (depth < maxDepth && !seen.has(f.id) && foldersSeen + queue.length < maxFolders) {
            seen.add(f.id);
            queue.push({ id: f.id, depth: depth + 1 });
          }
          continue;
        }
        if (!f.mimeType.startsWith("image/") && !f.mimeType.startsWith("video/")) continue;
        files.push({ id: f.id, name: f.name, mimeType: f.mimeType, url: driveImageUrl(f.id), thumb: driveThumbUrl(f.id, 400) });
        if (files.length >= maxFiles) { truncated = true; break; }
      }
      pageToken = d.nextPageToken ?? "";
      if (!pageToken) break;
    }
  }
  if (queue.length) truncated = true;
  return { files, foldersSeen, truncated };
}
