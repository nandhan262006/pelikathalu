import { NextResponse } from "next/server";
import { parseDriveLink, driveImageUrl, driveThumbUrl } from "@/lib/drive";
import { driveFileMeta, listDriveFolderRecursive } from "@/lib/r2";

export const maxDuration = 60;

type DriveFile = { id: string; name: string; mimeType: string; url: string; thumb: string };

function apiKey(): string | null {
  return process.env.DRIVE_API_KEY || null;
}

async function fileMeta(id: string, key: string): Promise<{ id: string; name: string; mimeType: string } | null> {
  try {
    return await driveFileMeta(id, key);
  } catch {
    return null;
  }
}

async function listFolderImages(
  folderId: string,
  key: string
): Promise<{ files: DriveFile[]; foldersSkipped: number; foldersSeen?: number; truncated?: boolean } | { error: string; status: number }> {
  try {
    // Recursive: wedding Drives are almost always nested (Haldi/Wedding/Reception).
    // Old code skipped subfolders entirely → "0 images found" even for full galleries.
    const { files, foldersSeen, truncated } = await listDriveFolderRecursive(folderId, key, {
      maxFiles: 1000,
      maxFolders: 50,
      maxDepth: 4,
    });
    return {
      files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.url, thumb: f.thumb })),
      foldersSkipped: 0,
      foldersSeen,
      truncated,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Drive resolve failed";
    if (msg.includes("not found")) return { error: msg, status: 404 };
    if (msg.includes("access denied") || msg.includes("Anyone")) return { error: msg, status: 403 };
    return { error: msg, status: 502 };
  }
}

export async function POST(req: Request) {
  const key = apiKey();
  if (!key) return NextResponse.json({ error: "DRIVE_API_KEY not configured" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw) return NextResponse.json({ error: "url required (Drive file or folder public link)" }, { status: 400 });

  let ref = parseDriveLink(raw);

  // Raw id pasted: parseDriveLink guesses "file" — verify, fall back to folder.
  if (ref?.kind === "file" && /^[\w-]{25,}$/.test(raw) && !raw.includes("/")) {
    const meta = await fileMeta(ref.id, key);
    if (!meta) {
      // maybe it's a folder id — try folder listing
      const listed = await listFolderImages(ref.id, key);
      if ("error" in listed) return NextResponse.json({ error: listed.error }, { status: listed.status });
      return NextResponse.json({ kind: "folder", id: ref.id, files: listed.files, foldersSeen: listed.foldersSeen, truncated: listed.truncated });
    }
    if (meta.mimeType === "application/vnd.google-apps.folder") {
      const listed = await listFolderImages(ref.id, key);
      if ("error" in listed) return NextResponse.json({ error: listed.error }, { status: listed.status });
      return NextResponse.json({ kind: "folder", id: ref.id, files: listed.files, foldersSeen: listed.foldersSeen, truncated: listed.truncated });
    }
    if (!meta.mimeType.startsWith("image/") && !meta.mimeType.startsWith("video/"))
      return NextResponse.json({ error: `That file is ${meta.mimeType}, not an image.` }, { status: 400 });
    return NextResponse.json({
      kind: "file",
      id: meta.id,
      files: [{ id: meta.id, name: meta.name, mimeType: meta.mimeType, url: driveImageUrl(meta.id), thumb: driveThumbUrl(meta.id, 400) }],
    });
  }

  if (!ref) return NextResponse.json({ error: "Could not read a Drive file/folder id from that link." }, { status: 400 });

  if (ref.kind === "file") {
    const meta = await fileMeta(ref.id, key);
    if (!meta)
      return NextResponse.json(
        { error: "Drive file not found or not public — set Share → Anyone with the link → Viewer." },
        { status: 404 }
      );
    if (meta.mimeType === "application/vnd.google-apps.folder") {
      const listed = await listFolderImages(ref.id, key);
      if ("error" in listed) return NextResponse.json({ error: listed.error }, { status: listed.status });
      return NextResponse.json({ kind: "folder", id: ref.id, files: listed.files, foldersSeen: listed.foldersSeen, truncated: listed.truncated });
    }
    if (!meta.mimeType.startsWith("image/") && !meta.mimeType.startsWith("video/"))
      return NextResponse.json({ error: `That file is ${meta.mimeType}, not an image.` }, { status: 400 });
    return NextResponse.json({
      kind: "file",
      id: meta.id,
      files: [{ id: meta.id, name: meta.name, mimeType: meta.mimeType, url: driveImageUrl(meta.id), thumb: driveThumbUrl(meta.id, 400) }],
    });
  }

  const listed = await listFolderImages(ref.id, key);
  if ("error" in listed) return NextResponse.json({ error: listed.error }, { status: listed.status });
  return NextResponse.json({ kind: "folder", id: ref.id, files: listed.files, foldersSeen: listed.foldersSeen, truncated: listed.truncated });
}
