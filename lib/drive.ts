export type DriveRef = { kind: "file" | "folder"; id: string };

/**
 * Extract a Drive file/folder id from the many public-link shapes:
 *  - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://drive.google.com/uc?id=FILE_ID&export=view
 *  - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 *  - https://drive.google.com/drive/u/0/folders/FOLDER_ID
 *  - https://drive.google.com/embeddedfolderview?id=FOLDER_ID
 *  - https://lh3.googleusercontent.com/d/FILE_ID (=w2000 optional)
 *  - raw id (25+ [A-Za-z0-9_-] chars)
 */
export function parseDriveLink(input: string): DriveRef | null {
  const s = input.trim();
  if (!s) return null;

  // raw id pasted directly
  if (/^[\w-]{25,}$/.test(s) && !s.includes("/") && !s.includes(" ")) {
    // ambiguous — treat as file; folder resolve will still work if caller tries both
    return { kind: "file", id: s };
  }

  let url: URL | null = null;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes("drive.google") && !host.includes("docs.google") && !host.includes("googleusercontent"))
    return null;

  const path = url.pathname;
  const params = url.searchParams;

  // /file/d/ID/...
  const fileM = /\/file\/d\/([\w-]{10,})/.exec(path);
  if (fileM) return { kind: "file", id: fileM[1] };

  // /drive/folders/ID  (also /drive/u/N/folders/ID)
  const folderM = /\/folders\/([\w-]{10,})/.exec(path);
  if (folderM) return { kind: "folder", id: folderM[1] };

  // lh3.googleusercontent.com/d/ID (=w2000 suffix optional) — the direct
  // image URL from Drive's "Copy image address", already valid as a file.
  const lh3m = /\/d\/([\w-]{10,})/.exec(path);
  if (lh3m) return { kind: "file", id: lh3m[1] };

  // ?id=ID  — could be file (open/uc) or folder (embeddedfolderview)
  const qid = params.get("id");
  if (qid && /^[\w-]{10,}$/.test(qid)) {
    if (path.includes("embeddedfolderview") || params.get("folder") === "1") {
      return { kind: "folder", id: qid };
    }
    return { kind: "file", id: qid };
  }

  return null;
}

/** Direct CDN image URL for a public Drive file — no API key needed in <img>. */
export function driveImageUrl(fileId: string, width = 2000): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

/** Fallback thumbnail URL (also keyless). */
export function driveThumbUrl(fileId: string, width = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/** Normalize any pasted URL: Drive share links → direct lh3 image URL. */
export function normalizeImageUrl(input: string): string {
  const ref = parseDriveLink(input);
  if (ref?.kind === "file") return driveImageUrl(ref.id);
  return input.trim();
}
