"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadToR2 } from "./fields";
import PhotoPreview from "./PhotoPreview";

/* ============================================================================
   Albums — Weddings & Portraits (admin panel, rebuilt)
   One section, three layers:
     1. Album list   — stats, filters, create, folder-drop to bulk-create
     2. Album editor — info, cover, photo grid (reorder/cover/delete)
     3. Add photos   — files/folder/drop, paste URLs, Drive → R2 import
   Server contracts (unchanged): /api/albums, /api/albums/[slug](/photos…),
   /api/r2/upload-url, /api/drive/resolve, /api/drive/import-to-r2.
   ========================================================================== */

type Album = {
  id: number;
  slug: string;
  title: string;
  couple: string | null;
  description: string | null;
  count: number;
  cover: string | null;
  coverUrl: string | null;
  category: "wedding" | "portrait";
  featured: boolean;
};

type Photo = { id: number; url: string; caption: string | null; sort: number };

type DriveFile = { id: string; name: string; url: string; thumb: string };

type PickedFile = { file: File; path: string };

const MEDIA_RE = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tif|tiff|svg|dng|mp4|mov|webm)$/i;

function isMediaFile(f: File, path?: string): boolean {
  if (f.type.startsWith("image/") || f.type.startsWith("video/")) return true;
  return MEDIA_RE.test(path ?? f.name ?? "");
}

function sortPicked(list: PickedFile[]): PickedFile[] {
  return [...list].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" })
  );
}

function prettifyFolder(name: string): string {
  return (
    name
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 80) || "Untitled gallery"
  );
}

/* ---------------- folder drag-and-drop (recursive walk) ---------------- */

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  name: string;
  file(ok: (f: File) => void, err?: (e: Error) => void): void;
  createReader(): {
    readEntries(ok: (entries: FileSystemEntryLike[]) => void, err?: (e: Error) => void): void;
  };
};

function readDirEntries(reader: {
  readEntries(ok: (entries: FileSystemEntryLike[]) => void, err?: (e: Error) => void): void;
}): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const read = () => {
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        read();
      }, reject);
    };
    read();
  });
}

function entryFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntryLike, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    try {
      const f = await entryFile(entry);
      out.push({ file: f, path: entry.fullPath || `/${f.name}` });
    } catch {
      // unreadable file — skip
    }
    return;
  }
  if (entry.isDirectory) {
    try {
      const children = await readDirEntries(entry.createReader());
      for (const child of children) await walkEntry(child, out);
    } catch {
      // unreadable dir — skip
    }
  }
}

function pathOf(f: File): string {
  return `/${(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}`;
}

async function filesFromDataTransfer(dt: DataTransfer): Promise<PickedFile[]> {
  const items = Array.from(dt.items ?? []);
  const entries: FileSystemEntryLike[] = [];
  for (const item of items) {
    const anyItem = item as unknown as {
      webkitGetAsEntry?: () => FileSystemEntryLike | null;
      getAsEntry?: () => FileSystemEntryLike | null;
    };
    const entry =
      (typeof anyItem.webkitGetAsEntry === "function" && anyItem.webkitGetAsEntry()) ||
      (typeof anyItem.getAsEntry === "function" && anyItem.getAsEntry()) ||
      null;
    if (entry) entries.push(entry);
  }
  if (!entries.length) {
    return Array.from(dt.files ?? []).map((f) => ({ file: f, path: pathOf(f) }));
  }
  const out: PickedFile[] = [];
  for (const entry of entries) await walkEntry(entry, out);
  if (!out.length && dt.files?.length) {
    return Array.from(dt.files).map((f) => ({ file: f, path: pathOf(f) }));
  }
  return out;
}

function groupByTopFolder(list: PickedFile[]): Map<string, PickedFile[]> {
  const groups = new Map<string, PickedFile[]>();
  for (const p of list) {
    const segs = p.path.split("/").filter(Boolean);
    // Real folder drop: /MyWedding/IMG_1.jpg → top "MyWedding". Loose: top "".
    const top = segs.length > 1 ? segs[0] : "";
    const g = groups.get(top) ?? [];
    g.push(p);
    groups.set(top, g);
  }
  return groups;
}

/* ------------------------------- component ------------------------------ */

export default function AlbumsPanel() {
  /* ---- list state ---- */
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "wedding" | "portrait">("all");
  const [form, setForm] = useState({
    title: "",
    couple: "",
    description: "",
    category: "wedding" as "wedding" | "portrait",
  });
  const [creating, setCreating] = useState(false);

  /* ---- dialog state ---- */
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [info, setInfo] = useState({ title: "", couple: "", description: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [thumbFit, setThumbFit] = useState<"fit" | "fill">("fit");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  /* ---- uploads ---- */
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [listDragging, setListDragging] = useState(false);
  const dragDepth = useRef(0);
  const tmpId = useRef(-1); // temp ids for optimistically appended grid rows

  /* ---- drive ---- */
  const [pasteUrls, setPasteUrls] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveKind, setDriveKind] = useState<"file" | "folder" | null>(null);
  const [driveMeta, setDriveMeta] = useState<{ foldersSeen?: number; truncated?: boolean } | null>(null);
  const [driveProgress, setDriveProgress] = useState<{ done: number; total: number } | null>(null);
  const [migrateBusy, setMigrateBusy] = useState(false);

  /* ---- misc ---- */
  const [msg, setMsg] = useState("");
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((m: string) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 4500);
  }, []);

  const active = useMemo(() => albums.find((a) => a.slug === selected) ?? null, [albums, selected]);
  const visibleAlbums = useMemo(
    () => albums.filter((a) => filter === "all" || a.category === filter),
    [albums, filter]
  );
  const stats = useMemo(
    () => ({
      total: albums.length,
      weddings: albums.filter((a) => a.category === "wedding").length,
      portraits: albums.filter((a) => a.category === "portrait").length,
      photos: albums.reduce((n, a) => n + a.count, 0),
    }),
    [albums]
  );

  /* ------------------------------ data layer ----------------------------- */

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/albums");
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { albums: Album[] };
      setAlbums(d.albums);
    } catch {
      flash("Failed to load albums — check your connection");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Open the editor and (re)load its photos. */
  const openAlbum = useCallback(
    async (slug: string) => {
      setSelected(slug);
      setModalOpen(true);
      setPreviewIndex(null);
      try {
        const r = await fetch(`/api/albums/${slug}/photos`);
        const d = r.ok ? ((await r.json()) as { photos: Photo[] }) : null;
        setPhotos(d?.photos ?? []);
      } catch {
        setPhotos([]);
        flash("Could not load photos — check connection");
      }
    },
    [flash]
  );

  // Keep the info fields in sync with the loaded album (dialog + list refreshes).
  useEffect(() => {
    if (!selected) return;
    const a = albums.find((x) => x.slug === selected);
    if (a) setInfo({ title: a.title, couple: a.couple ?? "", description: a.description ?? "" });
  }, [selected, albums]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelected(null);
    setPhotos([]);
    setPreviewIndex(null);
    setPasteUrls("");
    setDriveLink("");
    setDriveFiles([]);
    setDriveKind(null);
    setDriveMeta(null);
    setDriveProgress(null);
    setDragging(false);
    setUploadProgress(null);
    dragDepth.current = 0;
  }, []);

  // Escape closes the full preview first, then the dialog; lock background scroll.
  useEffect(() => {
    if (!modalOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewIndex !== null) setPreviewIndex(null);
        else closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen, closeModal, previewIndex]);

  const busy = !!uploadProgress || !!driveProgress || creating || coverBusy || migrateBusy;

  /* ----------------------------- album ops ------------------------------ */

  const createAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, title, featured: false }),
      });
      if (r.status === 409) return flash("That slug already exists — pick another title");
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        return flash(d.error ?? "Create failed");
      }
      const d = (await r.json()) as { album: Album };
      setForm({ title: "", couple: "", description: "", category: form.category });
      await refresh();
      void openAlbum(d.album.slug);
      flash(`Created “${d.album.title}” in ${form.category === "portrait" ? "Portraits" : "Weddings"} ✓`);
    } catch {
      flash("Create failed — network");
    } finally {
      setCreating(false);
    }
  };

  const patchAlbum = async (
    slug: string,
    patch: Partial<Pick<Album, "title" | "couple" | "description" | "cover" | "category" | "featured">>,
    okMsg: string
  ) => {
    try {
      const r = await fetch(`/api/albums/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        flash(d.error ?? "Save failed");
        return false;
      }
      await refresh();
      flash(okMsg);
      return true;
    } catch {
      flash("Save failed — network");
      return false;
    }
  };

  const saveInfo = async () => {
    if (!selected || savingInfo) return;
    const title = info.title.trim();
    if (!title) return flash("Title can't be empty");
    setSavingInfo(true);
    await patchAlbum(selected, { title, couple: info.couple, description: info.description }, "Album info saved ✓");
    setSavingInfo(false);
  };

  const removeAlbum = async (slug: string) => {
    const a = albums.find((x) => x.slug === slug);
    if (!window.confirm(`Delete “${a?.title ?? slug}” and all its photo links? The R2 files stay.`)) return;
    try {
      const r = await fetch(`/api/albums/${slug}`, { method: "DELETE" });
      if (!r.ok) return flash("Delete failed");
      if (selected === slug) closeModal();
      await refresh();
      flash("Album deleted");
    } catch {
      flash("Delete failed — network");
    }
  };

  /* ----------------------------- photo ops ------------------------------ */

  const attachUrlsToAlbum = async (slug: string, urls: string[]) => {
    const r = await fetch(`/api/albums/${slug}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    return r.ok;
  };

  const appendPhotosLocal = (urls: { url: string; caption: string | null }[]) => {
    if (!urls.length) return;
    setPhotos((cur) => {
      const base = cur.length ? Math.max(...cur.map((p) => p.sort)) : 0;
      return [
        ...cur,
        ...urls.map((n, i) => ({ id: tmpId.current--, url: n.url, caption: n.caption, sort: base + i + 1 })),
      ];
    });
  };

  const removePhoto = async (id: number) => {
    if (!selected || id < 0) return;
    const snapshot = photos;
    setPhotos((cur) => cur.filter((p) => p.id !== id));
    try {
      const r = await fetch(`/api/albums/${selected}/photos/${id}`, { method: "DELETE" });
      if (!r.ok) {
        setPhotos(snapshot);
        flash("Remove failed");
        return;
      }
      await refresh();
    } catch {
      setPhotos(snapshot);
      flash("Remove failed — network");
    }
  };

  // Delete from inside the full preview — stay open on the next photo.
  const removePhotoInPreview = async (id: number) => {
    if (!selected || previewIndex === null) return;
    if (!window.confirm("Delete this photo from the gallery? The R2 file stays.")) return;
    const next = photos.filter((p) => p.id !== id);
    try {
      const r = await fetch(`/api/albums/${selected}/photos/${id}`, { method: "DELETE" });
      if (!r.ok) return flash("Remove failed");
      setPhotos(next);
      await refresh();
      if (!next.length) setPreviewIndex(null);
      else setPreviewIndex(Math.min(previewIndex, next.length - 1));
    } catch {
      flash("Remove failed — network");
    }
  };

  const movePhoto = async (i: number, dir: number) => {
    if (!selected) return;
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    setPhotos(next);
    try {
      const r = await fetch(`/api/albums/${selected}/photos`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
      if (!r.ok) {
        setPhotos(photos);
        flash("Reorder failed");
      }
    } catch {
      setPhotos(photos);
      flash("Reorder failed — network");
    }
  };

  const setCover = async (url: string | null) => {
    if (!selected) return;
    setCoverBusy(true);
    await patchAlbum(selected, { cover: url }, url ? "Cover updated ✓" : "Cover reset to first photo ✓");
    setCoverBusy(false);
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setCoverBusy(true);
    try {
      const url = await uploadToR2(file);
      await patchAlbum(selected ?? "", { cover: url }, "Cover updated ✓");
    } catch {
      flash("Cover upload failed");
    } finally {
      setCoverBusy(false);
      if (coverFileRef.current) coverFileRef.current.value = "";
    }
  };

  const addPasted = async () => {
    if (!selected) return;
    const urls = pasteUrls
      .split(/\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u));
    if (!urls.length) return flash("No valid URLs found");
    const ok = await attachUrlsToAlbum(selected, urls);
    if (!ok) return flash("Attach failed — Drive links are auto-converted, use the Drive import below");
    setPasteUrls("");
    appendPhotosLocal(urls.map((u) => ({ url: u, caption: null })));
    await refresh();
    flash(`Added ${urls.length} photo${urls.length > 1 ? "s" : ""} by URL ✓`);
  };

  /* ------------------------------- uploads ------------------------------ */

  // 4 parallel presign+PUTs: fast for 200-photo folders, gentle on the browser.
  const uploadBatchToR2 = async (files: File[]): Promise<{ urls: (string | null)[]; failed: string[] }> => {
    const urls: (string | null)[] = new Array(files.length).fill(null);
    const failed: string[] = [];
    let done = 0;
    setUploadProgress({ done: 0, total: files.length });
    const CONC = 4;
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const i = cursor++;
        try {
          urls[i] = await uploadToR2(files[i]);
        } catch {
          failed.push(files[i].name);
        }
        done++;
        setUploadProgress({ done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, files.length) }, () => worker()));
    return { urls, failed };
  };

  const uploadPickedToAlbum = async (slug: string, picked: PickedFile[]) => {
    const sorted = sortPicked(picked);
    const media = sorted.filter((p) => isMediaFile(p.file, p.path));
    const skipped = sorted.length - media.length;
    if (!media.length) {
      flash(
        skipped > 0
          ? `No photos found — skipped ${skipped} non-image file${skipped > 1 ? "s" : ""}`
          : "No files found in that drop"
      );
      return;
    }
    flash(`Uploading ${media.length} photo${media.length > 1 ? "s" : ""}…`);
    const { urls, failed } = await uploadBatchToR2(media.map((p) => p.file));
    setUploadProgress(null);
    const good = urls.filter((u): u is string => !!u);
    if (!good.length) {
      flash(`All uploads failed${failed.length ? `: ${failed[0].slice(0, 60)}` : ""}`);
      return;
    }
    const ok = await attachUrlsToAlbum(slug, good);
    if (!ok) return flash("Uploads done but attach failed — try again or paste the URLs");
    appendPhotosLocal(good.map((u) => ({ url: u, caption: null })));
    await refresh();
    flash(
      `Added ${good.length} photo${good.length > 1 ? "s" : ""}` +
        (failed.length ? `, ${failed.length} failed (${failed[0].slice(0, 40)})` : "") +
        (skipped ? `, skipped ${skipped} non-image` : "") +
        " ✓"
    );
  };

  const uploadFiles = async (files: FileList | File[] | null) => {
    if (!files || !selected) return;
    const arr = Array.from(files);
    await uploadPickedToAlbum(selected, arr.map((f) => ({ file: f, path: pathOf(f) })));
    // Reset inputs so the same selection can be picked twice in a row.
    if (fileRef.current) fileRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  };

  // Drop inside an open gallery → add to that gallery.
  const handleModalDrop = async (dt: DataTransfer) => {
    if (!selected) return;
    const picked = await filesFromDataTransfer(dt);
    if (!picked.length) return flash("No files found in that drop");
    await uploadPickedToAlbum(selected, picked);
  };

  // Drop on the album list (no dialog open) → one new gallery per folder.
  const handleListDrop = async (dt: DataTransfer) => {
    const picked = await filesFromDataTransfer(dt);
    if (!picked.length) return flash("No files found in that drop");
    const groups = groupByTopFolder(picked);
    const folders = [...groups.entries()].filter(([top]) => top !== "");
    try {
      const createFor = async (title: string): Promise<Album | null> => {
        const r = await fetch("/api/albums", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            category: filter === "portrait" ? "portrait" : "wedding",
            featured: false,
          }),
        });
        if (!r.ok) return null;
        const d = (await r.json()) as { album: Album };
        return d.album;
      };

      if (!folders.length) {
        // Loose files — one gallery for the whole drop.
        const album = await createFor(`Dropped photos ${new Date().toLocaleDateString()}`);
        if (!album) return flash("Create failed for dropped files");
        await refresh();
        flash(`Created “${album.title}” — uploading…`);
        await uploadPickedToAlbum(album.slug, picked);
        return;
      }

      let n = 0;
      for (const [top, files] of folders) {
        const album = await createFor(prettifyFolder(top));
        if (!album) continue;
        await refresh();
        n++;
        flash(`Created “${album.title}” (${n}/${folders.length}) — uploading…`);
        await uploadPickedToAlbum(album.slug, files);
      }
      if (n) {
        await refresh();
        flash(
          folders.length > 1
            ? `Created ${n} ${n === 1 ? "gallery" : "galleries"} from ${folders.length} folders ✓`
            : "Created gallery from folder ✓"
        );
      } else flash("Create failed for dropped folders");
    } catch {
      flash("Drop import failed — network");
    } finally {
      setUploadProgress(null);
      setListDragging(false);
    }
  };

  /* --------------------------- drive → r2 import ------------------------- */

  const resolveDrive = async () => {
    if (!driveLink.trim()) return flash("Paste a Drive file or folder link first");
    setDriveBusy(true);
    try {
      const r = await fetch("/api/drive/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: driveLink.trim() }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        kind?: "file" | "folder";
        files?: DriveFile[];
        foldersSeen?: number;
        truncated?: boolean;
        error?: string;
      };
      if (!r.ok) {
        flash(d.error ?? "Drive resolve failed");
        setDriveFiles([]);
        setDriveKind(null);
        setDriveMeta(null);
        return;
      }
      setDriveFiles(d.files ?? []);
      setDriveKind(d.kind ?? null);
      setDriveMeta({ foldersSeen: d.foldersSeen, truncated: d.truncated });
      const extra =
        d.kind === "folder" && d.foldersSeen && d.foldersSeen > 1 ? ` across ${d.foldersSeen} subfolders` : "";
      const trunc = d.truncated ? " — list capped at 1000, import in parts" : "";
      flash(
        d.files?.length
          ? `Found ${d.files.length} image${d.files.length > 1 ? "s" : ""}${extra}${trunc} — they'll be stored as permanent R2 copies`
          : "No images found in that Drive link (check sharing: Anyone with the link → Viewer)"
      );
    } catch {
      flash("Drive resolve failed — network");
    } finally {
      setDriveBusy(false);
    }
  };

  const clearDrive = () => {
    setDriveFiles([]);
    setDriveLink("");
    setDriveKind(null);
    setDriveMeta(null);
    setDriveProgress(null);
  };

  /**
   * Copy Drive files into R2 and attach them. Speed: 3 workers × 6-id chunks
   * run concurrently (≈9 files in flight; the server copies 4 per request).
   * Each id gets one attempt per run; anything not imported stays listed, so
   * clicking Copy again resumes — the server skips what's already there.
   */
  const importDrive = async () => {
    if (!selected || !driveFiles.length || !!driveProgress) return;
    const nameOf = (id: string) => driveFiles.find((f) => f.id === id)?.name ?? id.slice(0, 8);
    const BATCH = 6;
    const WORKERS = 3;
    const total = driveFiles.length;
    const queue = driveFiles.map((f) => f.id);
    const remaining = new Set<string>();
    let importedTotal = 0;
    let skippedTotal = 0;
    let doneCount = 0;
    const errors: string[] = [];
    setDriveProgress({ done: 0, total });

    type ImportResult = {
      imported?: { driveId: string; r2Url: string; name: string }[];
      failed?: { driveId: string; error: string }[];
      skipped?: string[];
      error?: string;
    };

    const runChunk = async (ids: string[]) => {
      const finished = new Set<string>(); // imported/skipped → drop from the list
      const processed = new Set<string>(); // attempted → counts toward progress
      try {
        const r = await fetch("/api/drive/import-to-r2", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ albumSlug: selected, fileIds: ids }),
        });
        let d: ImportResult | null = null;
        try {
          d = (await r.json()) as ImportResult;
        } catch {
          d = null;
        }
        if (!d) {
          ids.forEach((id) => remaining.add(id));
          errors.push(`a batch timed out (HTTP ${r.status}) — copied files are kept, click Copy again to resume`);
          return;
        }
        const doneIds = new Set([...(d.imported ?? []).map((x) => x.driveId), ...(d.skipped ?? [])]);
        const failedIds = new Set((d.failed ?? []).map((f) => f.driveId));
        importedTotal += d.imported?.length ?? 0;
        skippedTotal += d.skipped?.length ?? 0;
        for (const f of d.failed ?? []) {
          errors.push(`${nameOf(f.driveId)}: ${f.error}`);
          remaining.add(f.driveId); // stay listed so Copy can be clicked again
        }
        if (!r.ok && !doneIds.size && !failedIds.size) {
          ids.forEach((id) => remaining.add(id));
          errors.push(d.error ?? `batch failed (${r.status}) — click Copy again to resume`);
          return;
        }
        doneIds.forEach((id) => finished.add(id));
        [...doneIds, ...failedIds].forEach((id) => processed.add(id));
        // Append the permanent R2 copies now; the final reconcile swaps temp ids.
        appendPhotosLocal((d.imported ?? []).map((x) => ({ url: x.r2Url, caption: x.name })));
      } catch {
        ids.forEach((id) => remaining.add(id));
        errors.push("network failed — copied files are kept, click Copy again to resume");
        return;
      } finally {
        const unaccounted = ids.filter((id) => !processed.has(id) && !remaining.has(id));
        unaccounted.forEach((id) => remaining.add(id));
        doneCount += processed.size;
        if (finished.size) setDriveFiles((cur) => cur.filter((f) => !finished.has(f.id)));
        setDriveProgress({ done: doneCount, total });
      }
    };

    const worker = async () => {
      while (queue.length) await runChunk(queue.splice(0, BATCH));
    };
    await Promise.all(Array.from({ length: WORKERS }, () => worker()));

    setDriveProgress(null);
    if (!remaining.size) {
      flash(
        `Stored ${importedTotal} permanent R2 cop${importedTotal === 1 ? "y" : "ies"}` +
          (skippedTotal ? `, ${skippedTotal} already in the gallery` : "") +
          (errors.length ? `, ${errors.length} failed: ${errors[errors.length - 1].slice(0, 110)}` : "") +
          " ✓"
      );
      clearDrive();
      await openAlbum(selected); // one refetch swaps temp grid rows for real ids
      await refresh();
    } else {
      flash(
        `Paused with ${remaining.size} left — click Copy again to resume` +
          (errors.length ? `: ${errors[errors.length - 1].slice(0, 130)}` : "")
      );
      await refresh();
    }
  };

  // One-click fix for galleries created before R2 copy existed (lh3 URLs → R2).
  const migrateDrivePhotos = async () => {
    if (!selected || migrateBusy) return;
    const driveCount = photos.filter(
      (p) => p.url.includes("googleusercontent") || p.url.includes("drive.google")
    ).length;
    if (!driveCount) return flash("No Drive URLs left in this gallery — all on R2 ✓");
    setMigrateBusy(true);
    let migratedTotal = 0;
    let remaining = driveCount;
    try {
      while (remaining > 0) {
        flash(`Moving old Drive photos to R2… ${migratedTotal}/${driveCount}`);
        const r = await fetch(`/api/albums/${selected}/migrate-to-r2`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 10 }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          migrated?: unknown[];
          failed?: { error: string }[];
          remaining?: number;
          error?: string;
        };
        if (!r.ok) {
          flash(d.error ?? "Migrate failed — check Drive sharing / API key");
          break;
        }
        migratedTotal += d.migrated?.length ?? 0;
        remaining = d.remaining ?? 0;
        await openAlbum(selected);
        if (!d.migrated?.length) {
          if (d.failed?.length) flash(`Stopped: ${d.failed[0].error.slice(0, 120)}`);
          break;
        }
        if (migratedTotal >= driveCount + 20) break; // safety
      }
      await refresh();
      flash(
        remaining === 0
          ? `All Drive photos now on R2 ✓ (${migratedTotal} moved)`
          : `Moved ${migratedTotal} to R2, ${remaining} left — click again to continue`
      );
    } catch {
      flash("Migrate failed — network");
    } finally {
      setMigrateBusy(false);
    }
  };

  /* -------------------------------- render ------------------------------- */

  const legacyDrivePhotos = photos.filter(
    (p) => p.url.includes("googleusercontent") || p.url.includes("drive.google")
  );

  return (
    <section
      className={`db-sec db-sec-open db-albums${listDragging ? " db-drop-active" : ""}`}
      onDragEnter={(e) => {
        if (modalOpen || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setListDragging(true);
      }}
      onDragOver={(e) => {
        if (modalOpen || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (modalOpen || e.currentTarget.contains(e.relatedTarget as Node)) return;
        setListDragging(false);
      }}
      onDrop={(e) => {
        if (modalOpen || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setListDragging(false);
        void handleListDrop(e.dataTransfer);
      }}
    >
      <div className="db-sec-head db-albums-head">
        <span>Albums — Weddings &amp; Portraits</span>
        {msg && <em className="db-albums-msg">{msg}</em>}
      </div>

      <div className="db-sec-body">
        {loading ? (
          <p className="db-albums-hint">Loading albums…</p>
        ) : (
          <>
            {/* stats */}
            <div className="db-album-stats">
              <span className="db-stat">
                <strong>{stats.total}</strong> albums
              </span>
              <span className="db-stat">
                <strong>{stats.weddings}</strong> weddings
              </span>
              <span className="db-stat">
                <strong>{stats.portraits}</strong> portraits
              </span>
              <span className="db-stat">
                <strong>{stats.photos}</strong> photos
              </span>
            </div>

            <p className="db-albums-hint">
              <strong>Wedding</strong> albums show at <code>/weddings</code> + home Weddings;{" "}
              <strong>Portrait</strong> albums show at <code>/portraits</code> + home Portraits.{" "}
              <strong>★ Featured</strong> albums also show in the home Gallery.
            </p>

            {/* filter tabs */}
            <div className="db-row" style={{ marginBottom: 10 }}>
              {(["all", "wedding", "portrait"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`db-btn db-btn-sm${filter === f ? " db-btn-active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? `All (${stats.total})`
                    : f === "wedding"
                      ? `Weddings (${stats.weddings})`
                      : `Portraits (${stats.portraits})`}
                </button>
              ))}
            </div>

            {/* create form */}
            <form className="db-albums-new" onSubmit={(e) => void createAlbum(e)}>
              <input
                className="db-input"
                placeholder="Title — e.g. Priya + Arjun / Ananya — Portraits"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <div className="db-row">
                <select
                  className="db-input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as "wedding" | "portrait" })}
                  aria-label="Album category"
                >
                  <option value="wedding">Wedding</option>
                  <option value="portrait">Portrait</option>
                </select>
                <input
                  className="db-input"
                  placeholder="Names (optional)"
                  value={form.couple}
                  onChange={(e) => setForm({ ...form, couple: e.target.value })}
                />
                <input
                  className="db-input"
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <button type="submit" className="db-btn db-btn-sm" disabled={!form.title.trim() || creating}>
                  {creating ? "Creating…" : "+ Create"}
                </button>
              </div>
            </form>

            {/* album list */}
            <div className="db-albums-list">
              {visibleAlbums.map((a) => (
                <div key={a.slug} className="db-album-row">
                  {(a.cover ?? a.coverUrl) && (
                    <img className="db-album-thumb" src={a.cover ?? a.coverUrl ?? ""} alt="" loading="lazy" />
                  )}
                  <button
                    type="button"
                    className="db-album-name"
                    onClick={() => void openAlbum(a.slug)}
                    title="Click to edit in popup"
                  >
                    <span className={`db-badge${a.category === "portrait" ? " db-badge-p" : ""}`}>
                      {a.category === "portrait" ? "Portrait" : "Wedding"}
                    </span>
                    {a.featured ? "★ " : ""}
                    {a.title} <em className="db-count">{a.count}</em>
                  </button>
                  <a
                    className="db-album-slug"
                    href={`/${a.category === "portrait" ? "portraits" : "weddings"}/${a.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open live gallery"
                  >
                    /{a.category === "portrait" ? "portraits" : "weddings"}/{a.slug} ↗
                  </a>
                  <button type="button" className="db-btn db-btn-sm" onClick={() => void openAlbum(a.slug)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="db-mini db-mini-del"
                    onClick={() => void removeAlbum(a.slug)}
                    aria-label={`Delete ${a.title}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {visibleAlbums.length === 0 && (
                <p className="db-albums-hint">
                  No {filter === "wedding" ? "wedding" : filter === "portrait" ? "portrait" : ""} albums here yet —
                  create one above.
                </p>
              )}
            </div>

            {/* list dropzone */}
            <div className={`db-dropzone${listDragging ? " db-dropzone-on" : ""}`}>
              <span>
                {listDragging
                  ? "Drop to create galleries — one per folder, named after the folder 📁"
                  : "Tip: drag a folder from your PC here — one gallery per folder, auto-named. Or drop files to make a single gallery."}
              </span>
              {uploadProgress && !modalOpen && (
                <span className="db-progress" role="status" aria-live="polite">
                  <i style={{ width: `${Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%` }} />
                  <em>
                    {uploadProgress.done}/{uploadProgress.total}
                  </em>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------ editor ------------------------------ */}
      {modalOpen && active && (
        <div
          className="db-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit gallery ${active.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className={`db-modal${dragging ? " db-drop-active" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragDepth.current++;
              if (e.dataTransfer.types.includes("Files")) setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragDepth.current = 0;
              setDragging(false);
              if (e.dataTransfer.types.includes("Files")) void handleModalDrop(e.dataTransfer);
            }}
          >
            {/* head */}
            <div className="db-modal-head">
              <div className="db-modal-title">
                {(active.cover ?? active.coverUrl) && (
                  <img className="db-modal-cover" src={active.cover ?? active.coverUrl ?? ""} alt="" />
                )}
                <div>
                  <strong>
                    {active.featured ? "★ " : ""}
                    {active.title}
                  </strong>
                  <span className={`db-badge${active.category === "portrait" ? " db-badge-p" : ""}`}>
                    {active.category === "portrait" ? "Portrait" : "Wedding"}
                  </span>
                  <span className="db-modal-sub">
                    /{active.category === "portrait" ? "portraits" : "weddings"}/{active.slug} ·{" "}
                    {photos.length} {photos.length === 1 ? "photo" : "photos"} ·{" "}
                    <a
                      href={`/${active.category === "portrait" ? "portraits" : "weddings"}/${active.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View live ↗
                    </a>
                  </span>
                  {msg && <em className="db-albums-msg">{msg}</em>}
                </div>
              </div>
              <button type="button" className="db-modal-close" onClick={closeModal} aria-label="Close editor">
                ✕
              </button>
            </div>

            <div className="db-modal-body">
              {/* actions */}
              <div className="db-modal-actions">
                <button
                  type="button"
                  className="db-btn db-btn-sm"
                  onClick={() =>
                    void patchAlbum(
                      active.slug,
                      { category: active.category === "portrait" ? "wedding" : "portrait" },
                      `Moved to ${active.category === "portrait" ? "Weddings" : "Portraits"} ✓`
                    )
                  }
                >
                  → Move to {active.category === "portrait" ? "Weddings" : "Portraits"}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn-sm"
                  onClick={() =>
                    void patchAlbum(
                      active.slug,
                      { featured: !active.featured },
                      active.featured ? "Removed from home featured" : "★ Featured on home ✓"
                    )
                  }
                >
                  {active.featured ? "☆ Unfeature" : "★ Feature on home"}
                </button>
                <button
                  type="button"
                  className="db-btn db-btn-sm db-btn-primary"
                  disabled={savingInfo}
                  onClick={() => void saveInfo()}
                >
                  {savingInfo ? "Saving…" : "Save info"}
                </button>
                <button type="button" className="db-btn db-btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {uploadProgress ? "Uploading…" : "⬆ Upload photos"}
                </button>
                <button type="button" className="db-btn db-btn-sm" disabled={busy} onClick={() => folderRef.current?.click()}>
                  📁 Upload folder
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*,.heic,.heif,.avif,.gif,.bmp,.tif,.tiff,.dng"
                  hidden
                  multiple
                  onChange={(e) => void uploadFiles(e.target.files)}
                />
                <input
                  ref={folderRef}
                  type="file"
                  accept="image/*,video/*,.heic,.heif,.avif,.gif,.bmp,.tif,.tiff,.dng"
                  hidden
                  multiple
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  onChange={(e) => void uploadFiles(e.target.files)}
                />
              </div>

              <p className="db-albums-hint" style={{ margin: 0 }}>
                Or drag &amp; drop files or a whole folder from your PC anywhere in this popup — subfolders included,
                sorted by name.
              </p>

              {uploadProgress && (
                <div className="db-progress" role="status" aria-live="polite">
                  <i style={{ width: `${Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%` }} />
                  <em>
                    Uploading {uploadProgress.done}/{uploadProgress.total}…
                  </em>
                </div>
              )}

              {dragging && (
                <div className="db-drop-overlay" aria-hidden>
                  <strong>Drop to add to “{active.title}”</strong>
                  <span>Files or a full folder — subfolders are read too</span>
                </div>
              )}

              {/* info */}
              <div className="db-row">
                <input
                  className="db-input"
                  value={info.title}
                  onChange={(e) => setInfo({ ...info, title: e.target.value })}
                  placeholder="Gallery title"
                  aria-label="Gallery title"
                />
                <input
                  className="db-input"
                  value={info.couple}
                  onChange={(e) => setInfo({ ...info, couple: e.target.value })}
                  placeholder="Names (optional)"
                  aria-label="Names"
                />
                <input
                  className="db-input"
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                  placeholder="Description (shown on gallery page)"
                  aria-label="Gallery description"
                />
              </div>

              {/* cover */}
              <div className="db-cover-row">
                {(active.cover ?? active.coverUrl) && (
                  <img className="db-cover-thumb" src={active.cover ?? active.coverUrl ?? ""} alt="Gallery cover" />
                )}
                <div className="db-cover-actions">
                  <strong className="db-label">Cover — first photo is default, ★ any photo to override</strong>
                  <span className="db-item-actions">
                    <button
                      type="button"
                      className="db-btn db-btn-sm"
                      disabled={coverBusy}
                      onClick={() => coverFileRef.current?.click()}
                    >
                      {coverBusy ? "Working…" : "⬆ Upload cover"}
                    </button>
                    <button
                      type="button"
                      className="db-btn db-btn-sm"
                      disabled={coverBusy || !active.cover}
                      onClick={() => void setCover(null)}
                    >
                      Use first photo
                    </button>
                  </span>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => void uploadCover(e.target.files?.[0])}
                  />
                </div>
              </div>

              {/* grid */}
              <div className="db-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="db-albums-hint" style={{ margin: 0 }}>
                  {photos.length} photo{photos.length === 1 ? "" : "s"} — click any photo for full view
                </span>
                <span className="db-item-actions" role="group" aria-label="Thumbnail view">
                  <button
                    type="button"
                    className={`db-btn db-btn-sm${thumbFit === "fit" ? " db-btn-active" : ""}`}
                    onClick={() => setThumbFit("fit")}
                    title="Show complete image, no crop"
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    className={`db-btn db-btn-sm${thumbFit === "fill" ? " db-btn-active" : ""}`}
                    onClick={() => setThumbFit("fill")}
                    title="Fill crop (how cover cards look)"
                  >
                    Fill
                  </button>
                </span>
              </div>

              <div className={`db-album-grid db-modal-grid ${thumbFit === "fill" ? "db-fill" : "db-fit"}`}>
                {photos.map((p, i) => (
                  <figure key={p.id} className="db-album-photo">
                    <img
                      src={p.url}
                      alt={`Photo ${i + 1} — click to enlarge`}
                      loading="lazy"
                      title="Click for full preview popup"
                      onClick={() => setPreviewIndex(i)}
                    />
                    <span className="db-photo-num">{i + 1}</span>
                    <figcaption>
                      <button type="button" className="db-mini" onClick={() => setPreviewIndex(i)} aria-label="Open full preview" title="Full preview">⤢</button>
                      <button type="button" className="db-mini" disabled={i === 0} onClick={() => void movePhoto(i, -1)} aria-label="Move earlier" title="Move earlier">↑</button>
                      <button type="button" className="db-mini" disabled={i === photos.length - 1} onClick={() => void movePhoto(i, 1)} aria-label="Move later" title="Move later">↓</button>
                      <button
                        type="button"
                        className={`db-mini ${p.url === (active.cover ?? active.coverUrl) ? "db-mini-cover-on" : ""}`}
                        disabled={coverBusy}
                        title="Set as gallery cover"
                        onClick={() => void setCover(p.url)}
                      >
                        ★
                      </button>
                      <button type="button" className="db-mini db-mini-del" disabled={p.id < 0} onClick={() => void removePhoto(p.id)} aria-label="Remove photo" title="Remove">✕</button>
                    </figcaption>
                  </figure>
                ))}
                {photos.length === 0 && (
                  <p className="db-albums-hint">No photos yet — upload above, drop files here, or use the Drive import below.</p>
                )}
              </div>

              {/* paste urls */}
              <label className="db-field">
                <span className="db-label">Add photos by URL (space/newline separated)</span>
                <textarea
                  className="db-input db-textarea"
                  rows={2}
                  value={pasteUrls}
                  onChange={(e) => setPasteUrls(e.target.value)}
                  placeholder="https://pub-….r2.dev/images/web/…"
                />
                <button type="button" className="db-btn db-btn-add" disabled={!pasteUrls.trim()} onClick={() => void addPasted()}>
                  + Attach URLs
                </button>
              </label>

              {/* drive → r2 */}
              <div className="db-field" style={{ border: "1px dashed var(--db-line)", borderRadius: 8, padding: 10 }}>
                <span className="db-label">Google Drive → R2 import — paste a public file or folder link</span>
                <span className="db-albums-hint" style={{ margin: 0 }}>
                  Share in Drive → Anyone with the link → Viewer, then paste here. Subfolders are scanned too. Files
                  are copied into permanent R2 storage — Drive links are never kept, so galleries never break.
                </span>

                {legacyDrivePhotos.length > 0 && (
                  <div className="db-row" style={{ marginTop: 6 }}>
                    <span className="db-albums-hint" style={{ margin: 0 }}>
                      ⚠ {legacyDrivePhotos.length} old Drive-linked photo{legacyDrivePhotos.length > 1 ? "s" : ""} will
                      break — move them to R2:
                    </span>
                    <button
                      type="button"
                      className="db-btn db-btn-sm db-btn-primary"
                      disabled={migrateBusy || !!driveProgress}
                      onClick={() => void migrateDrivePhotos()}
                    >
                      {migrateBusy ? "Moving…" : "⇩ Move old Drive photos to R2"}
                    </button>
                  </div>
                )}

                <div className="db-row">
                  <input
                    className="db-input"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/… or /file/d/…"
                    aria-label="Google Drive link"
                  />
                  <button
                    type="button"
                    className="db-btn db-btn-sm"
                    disabled={!driveLink.trim() || driveBusy || !!driveProgress}
                    onClick={() => void resolveDrive()}
                  >
                    {driveBusy ? "Reading…" : "Check Drive"}
                  </button>
                </div>

                {driveProgress && (
                  <div className="db-progress" role="status" aria-live="polite">
                    <i style={{ width: `${Math.round((driveProgress.done / Math.max(1, driveProgress.total)) * 100)}%` }} />
                    <em>
                      Copying Drive → R2 {driveProgress.done}/{driveProgress.total}…
                    </em>
                  </div>
                )}

                {driveFiles.length > 0 && (
                  <>
                    <span className="db-albums-hint">
                      {driveKind === "folder" ? "Folder" : "File"} → {driveFiles.length} image
                      {driveFiles.length > 1 ? "s" : ""} ready
                      {driveMeta?.foldersSeen && driveMeta.foldersSeen > 1
                        ? ` (found across ${driveMeta.foldersSeen} folders)`
                        : ""}
                      {driveMeta?.truncated ? " — capped at 1000, import then re-check for more" : ""}
                    </span>
                    <div className="db-album-grid" style={{ maxHeight: 180 }}>
                      {driveFiles.slice(0, 24).map((f) => (
                        <figure key={f.id} className="db-album-photo" title={f.name}>
                          <img src={f.thumb} alt={f.name} loading="lazy" />
                        </figure>
                      ))}
                    </div>
                    {driveFiles.length > 24 && (
                      <span className="db-albums-hint">+ {driveFiles.length - 24} more — all will be copied to R2</span>
                    )}
                    <div className="db-row">
                      <button
                        type="button"
                        className="db-btn db-btn-sm db-btn-primary"
                        disabled={!!driveProgress}
                        onClick={() => void importDrive()}
                      >
                        {driveProgress
                          ? `Copying… ${driveProgress.done}/${driveProgress.total}`
                          : `⇩ Copy ${driveFiles.length} to R2 gallery`}
                      </button>
                      <button type="button" className="db-btn db-btn-sm" disabled={!!driveProgress} onClick={clearDrive}>
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* foot */}
            <div className="db-modal-foot">
              <button
                type="button"
                className="db-btn db-btn-sm db-mini-del"
                onClick={() => void removeAlbum(active.slug)}
              >
                Delete gallery
              </button>
              <span className="db-item-actions">
                <button type="button" className="db-btn db-btn-sm" onClick={closeModal}>
                  Close
                </button>
                <button
                  type="button"
                  className="db-btn db-btn-sm db-btn-primary"
                  disabled={savingInfo}
                  onClick={async () => {
                    await saveInfo();
                    closeModal();
                  }}
                >
                  {savingInfo ? "Saving…" : "Save & close"}
                </button>
              </span>
            </div>
          </div>

          {previewIndex !== null && photos.length > 0 && (
            <PhotoPreview
              photos={photos}
              index={Math.min(previewIndex, photos.length - 1)}
              coverUrl={active.coverUrl}
              coverBusy={coverBusy}
              onIndex={(i) => setPreviewIndex(i)}
              onClose={() => setPreviewIndex(null)}
              onSetCover={(url) => void setCover(url)}
              onDelete={(id) => void removePhotoInPreview(id)}
            />
          )}
        </div>
      )}
    </section>
  );
}
