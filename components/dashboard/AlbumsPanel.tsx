"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadToR2 } from "./fields";
import PhotoPreview from "./PhotoPreview";

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
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80) || "Untitled gallery";
}

// Read a directory entry recursively — this is what makes folder drops work.
// Uses webkitGetAsEntry (Chrome/Edge/Safari); falls back to flat file list elsewhere.
function readDirEntries(reader: {
  readEntries(
    ok: (entries: FileSystemEntryLike[]) => void,
    err?: (e: Error) => void
  ): void;
}): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const read = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) return resolve(all);
          all.push(...batch);
          read();
        },
        (e) => reject(e)
      );
    };
    read();
  });
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  name: string;
  file(ok: (f: File) => void, err?: (e: Error) => void): void;
  createReader(): {
    readEntries(
      ok: (entries: FileSystemEntryLike[]) => void,
      err?: (e: Error) => void
    ): void;
  };
};

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
  // No entries (e.g. Firefox file-only drop) — use the flat file list.
  if (!entries.length) {
    return Array.from(dt.files ?? []).map((f) => ({
      file: f,
      path: `/${(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}`,
    }));
  }
  const out: PickedFile[] = [];
  for (const entry of entries) await walkEntry(entry, out);
  // Fallback: entry walk found nothing (e.g. item kinds unsupported) — use flat list.
  if (!out.length && dt.files?.length) {
    return Array.from(dt.files).map((f) => ({
      file: f,
      path: `/${(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}`,
    }));
  }
  return out;
}

function groupByTopFolder(list: PickedFile[]): Map<string, PickedFile[]> {
  const groups = new Map<string, PickedFile[]>();
  for (const p of list) {
    const segs = p.path.split("/").filter(Boolean);
    // A real folder drop looks like /MyWedding/IMG_1.jpg → top = "MyWedding".
    // Loose files look like /IMG_1.jpg → top = "" (no folder).
    const top = segs.length > 1 ? segs[0] : "";
    const g = groups.get(top) ?? [];
    g.push(p);
    groups.set(top, g);
  }
  return groups;
}

export default function AlbumsPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", couple: "", description: "", category: "wedding" as "wedding" | "portrait" });
  const [filter, setFilter] = useState<"all" | "wedding" | "portrait">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [pasteUrls, setPasteUrls] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; url: string; thumb: string }[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveKind, setDriveKind] = useState<"file" | "folder" | null>(null);
  const [driveMeta, setDriveMeta] = useState<{ foldersSeen?: number; truncated?: boolean } | null>(null);
  const [driveProgress, setDriveProgress] = useState<{ done: number; total: number } | null>(null);
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [thumbFit, setThumbFit] = useState<"fit" | "fill">("fit");
  const [dragging, setDragging] = useState(false);
  const [listDragging, setListDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const dragDepth = useRef(0);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 4000);
  };

  const refresh = useCallback(async () => {
    const r = await fetch("/api/albums");
    if (!r.ok) return flash("Failed to load albums");
    const d = (await r.json()) as { albums: Album[] };
    setAlbums(d.albums);
  }, []);

  const select = useCallback(async (slug: string) => {
    setSelected(slug);
    setModalOpen(true);
    const r = await fetch(`/api/albums/${slug}/photos`);
    if (r.ok) setPhotos(((await r.json()) as { photos: Photo[] }).photos);
    else setPhotos([]);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelected(null);
    setPhotos([]);
    setPasteUrls("");
    setPreviewIndex(null);
    setDriveLink("");
    setDriveFiles([]);
    setDriveKind(null);
    setDriveMeta(null);
    setDriveProgress(null);
    setDragging(false);
    setUploadProgress(null);
    dragDepth.current = 0;
  }, []);

  // Escape closes photo preview first, then the popup; lock background scroll while open.
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const r = await fetch("/api/albums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, featured: false }),
    });
    if (r.status === 409) return flash("That slug already exists");
    if (!r.ok) return flash("Create failed");
    const d = (await r.json()) as { album: Album };
    setForm({ title: "", couple: "", description: "", category: form.category });
    await refresh();
    void select(d.album.slug);
    flash(`Album created in ${form.category === "portrait" ? "Portraits" : "Weddings"}`);
  };

  // 4 parallel PUTs: fast for 200-photo wedding folders, still gentle on R2/browsers.
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

  const attachUrlsToAlbum = async (slug: string, urls: string[]) => {
    const r = await fetch(`/api/albums/${slug}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    return r.ok;
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
    setBusy(true);
    flash(`Uploading ${media.length} photo${media.length > 1 ? "s" : ""}… 0/${media.length}`);
    const files = media.map((p) => p.file);
    const { urls, failed } = await uploadBatchToR2(files);
    const good = urls.filter((u): u is string => !!u);
    setUploadProgress(null);
    if (good.length) {
      const ok = await attachUrlsToAlbum(slug, good);
      if (ok) {
        flash(
          `Added ${good.length} photo${good.length > 1 ? "s" : ""}` +
            (failed.length ? `, ${failed.length} failed (${failed[0].slice(0, 40)})` : "") +
            (skipped ? `, skipped ${skipped} non-image` : "")
        );
        await select(slug);
        await refresh();
      } else flash("Upload done but attach failed");
    } else {
      flash(`All uploads failed${failed.length ? `: ${failed[0].slice(0, 60)}` : ""}`);
    }
    setBusy(false);
  };

  const uploadFiles = async (files: FileList | File[] | null) => {
    if (!files || !selected) return;
    const arr = Array.isArray(files) ? files : Array.from(files);
    await uploadPickedToAlbum(
      selected,
      arr.map((f) => ({
        file: f,
        path: `/${(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}`,
      }))
    );
    // Reset inputs so the same folder can be picked twice in a row.
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

  // Drop on the album list (no popup open) → one new gallery per folder.
  const handleListDrop = async (dt: DataTransfer) => {
    const picked = await filesFromDataTransfer(dt);
    if (!picked.length) return flash("No files found in that drop");
    const groups = groupByTopFolder(picked);
    const folders = [...groups.entries()].filter(([top]) => top !== "");
    setBusy(true);
    try {
      if (!folders.length) {
        // Loose files — one gallery for the whole drop.
        const title = `Dropped photos ${new Date().toLocaleDateString()}`;
        const r = await fetch("/api/albums", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            category: filter === "portrait" ? "portrait" : "wedding",
            featured: false,
          }),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => null)) as { error?: string } | null;
          flash(d?.error ?? "Create failed for dropped files");
          return;
        }
        const d = (await r.json()) as { album: Album };
        await refresh();
        flash(`Created “${d.album.title}” — uploading…`);
        setBusy(false);
        await uploadPickedToAlbum(d.album.slug, picked);
        return;
      }
      let n = 0;
      for (const [top, files] of folders) {
        const title = prettifyFolder(top);
        const r = await fetch("/api/albums", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            category: filter === "portrait" ? "portrait" : "wedding",
            featured: false,
          }),
        });
        if (!r.ok) continue;
        const d = (await r.json()) as { album: Album };
        await refresh();
        n++;
        flash(`Created “${d.album.title}” (${n}/${folders.length}) — uploading…`);
        await uploadPickedToAlbum(d.album.slug, files);
      }
      if (n) {
        await refresh();
        flash(
          folders.length > 1
            ? `Created ${n} galler${n > 1 ? "ies" : "y"} from ${folders.length} folders ✓`
            : `Created gallery from folder ✓`
        );
      } else flash("Create failed for dropped folders");
    } finally {
      setBusy(false);
      setUploadProgress(null);
      setListDragging(false);
    }
  };

  const addPasted = async () => {
    if (!selected) return;
    const urls = pasteUrls
      .split(/\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u));
    if (!urls.length) return flash("No valid URLs");
    const r = await fetch(`/api/albums/${selected}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    if (r.ok) {
      setPasteUrls("");
      await select(selected);
      await refresh();
      flash(`Added ${urls.length} by URL`);
    } else {
      flash("Attach failed — Drive links are auto-converted, folders use Drive import below");
    }
  };

  const resolveDrive = async () => {
    if (!driveLink.trim()) return flash("Paste a Drive file or folder link first");
    setDriveBusy(true);
    try {
      const r = await fetch("/api/drive/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: driveLink.trim() }),
      });
      const d = (await r.json()) as {
        kind?: "file" | "folder";
        files?: { id: string; name: string; url: string; thumb: string }[];
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
        d.kind === "folder" && d.foldersSeen && d.foldersSeen > 1 ? ` (scanned ${d.foldersSeen} subfolders)` : "";
      const trunc = d.truncated ? " — list capped at 1000, import in parts" : "";
      flash(
        d.files?.length
          ? `Found ${d.files.length} image${d.files.length > 1 ? "s" : ""} in Drive${extra}${trunc} — stored as permanent R2 copies`
          : "No images found in that Drive link (check sharing: Anyone with the link → Viewer)"
      );
    } catch {
      flash("Drive resolve failed — network");
    } finally {
      setDriveBusy(false);
    }
  };

  // Drive → R2: download bytes server-side, store permanent R2 copies, attach to album.
  // Drive lh3 URLs are never stored — they 403/quota-throttle and break galleries.
  // Small batches + resume: a timed-out batch keeps what's already copied; the
  // leftovers stay listed so Copy can be clicked again without duplicating.
  const importDrive = async () => {
    if (!selected || !driveFiles.length) return;
    setBusy(true);
    const nameOf = (id: string) => driveFiles.find((f) => f.id === id)?.name ?? id.slice(0, 8);
    let pending = driveFiles.map((f) => f.id);
    const BATCH = 6; // small batches: wedding files are 10-20MB, keeps each request well under 60s
    const total = pending.length;
    let importedTotal = 0;
    let skippedTotal = 0;
    const errors: string[] = [];
    setDriveProgress({ done: 0, total });
    while (pending.length) {
      const chunk = pending.slice(0, BATCH);
      const doneCount = total - pending.length;
      flash(`Copying Drive → R2: ${doneCount + 1}–${doneCount + chunk.length} of ${total}…`);
      let progressed = false;
      try {
        const r = await fetch(`/api/drive/import-to-r2`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ albumSlug: selected, fileIds: chunk }),
        });
        type ImportResult = {
          imported?: { driveId: string }[];
          failed?: { driveId: string; error: string }[];
          skipped?: string[];
          error?: string;
        };
        let d: ImportResult | null = null;
        try {
          d = (await r.json()) as ImportResult;
        } catch {
          d = null;
        }
        if (!d) {
          errors.push(`server timed out (HTTP ${r.status}) — already-copied files are kept, click Copy again to resume`);
          break;
        }
        const doneIds = new Set([...(d.imported ?? []).map((x) => x.driveId), ...(d.skipped ?? [])]);
        importedTotal += d.imported?.length ?? 0;
        skippedTotal += d.skipped?.length ?? 0;
        for (const f of d.failed ?? []) errors.push(`${nameOf(f.driveId)}: ${f.error}`);
        if (!r.ok && !doneIds.size) {
          errors.push(d.error ?? `batch failed (${r.status}) — click Copy again to resume`);
          break;
        }
        pending = pending.filter((id) => !doneIds.has(id));
        progressed = true;
      } catch {
        errors.push("network failed — already-copied files are kept, click Copy again to resume");
        break;
      }
      setDriveProgress({ done: total - pending.length, total });
      setDriveFiles((cur) => cur.filter((f) => pending.includes(f.id)));
      await select(selected);
      if (!progressed) break;
    }
    setDriveProgress(null);
    if (!pending.length) {
      flash(
        `Stored ${importedTotal} permanent R2 cop${importedTotal === 1 ? "y" : "ies"}` +
          (skippedTotal ? `, ${skippedTotal} already in gallery` : "") +
          (errors.length ? `, ${errors.length} failed: ${errors[errors.length - 1].slice(0, 110)}` : "")
      );
      setDriveFiles([]);
      setDriveLink("");
      setDriveKind(null);
      setDriveMeta(null);
      await refresh();
    } else {
      flash(
        `Paused with ${pending.length} left — click Copy again to resume` +
          (errors.length ? `: ${errors[errors.length - 1].slice(0, 130)}` : "")
      );
      await refresh();
    }
    setBusy(false);
  };

  // One-click fix for galleries created before R2 copy existed (lh3 URLs → R2).
  const migrateDrivePhotos = async () => {
    if (!selected) return;
    const driveOnes = photos.filter((p) => p.url.includes("googleusercontent") || p.url.includes("drive.google"));
    if (!driveOnes.length) return flash("No Drive URLs left in this gallery — all on R2 ✓");
    setMigrateBusy(true);
    let migratedTotal = 0;
    let remaining = driveOnes.length;
    try {
      while (remaining > 0) {
        flash(`Moving old Drive photos to R2… ${migratedTotal}/${driveOnes.length}`);
        const r = await fetch(`/api/albums/${selected}/migrate-to-r2`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 10 }),
        });
        const d = (await r.json()) as {
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
        await select(selected);
        if (!d.migrated?.length) {
          if ((d.failed?.length ?? 0) > 0) flash(`Stopped: ${d.failed![0].error.slice(0, 120)}`);
          break;
        }
        if (migratedTotal >= driveOnes.length + 20) break; // safety
      }
      await refresh();
      flash(remaining === 0 ? `All Drive photos now on R2 ✓ (${migratedTotal})` : `Moved ${migratedTotal} to R2, ${remaining} left`);
    } catch {
      flash("Migrate failed — network");
    } finally {
      setMigrateBusy(false);
    }
  };

  const removePhoto = async (id: number) => {
    if (!selected) return;
    await fetch(`/api/albums/${selected}/photos/${id}`, { method: "DELETE" });
    await select(selected);
    await refresh();
  };

  // Delete from inside the full preview popup — stay open on the next photo.
  const removePhotoInPreview = async (id: number) => {
    if (!selected || previewIndex === null) return;
    if (!window.confirm("Delete this photo from the gallery? R2 file stays.")) return;
    await fetch(`/api/albums/${selected}/photos/${id}`, { method: "DELETE" });
    const r = await fetch(`/api/albums/${selected}/photos`);
    const next = r.ok ? (((await r.json()) as { photos: Photo[] }).photos ?? []) : photos.filter((p) => p.id !== id);
    setPhotos(next);
    await refresh();
    if (!next.length) setPreviewIndex(null);
    else setPreviewIndex(Math.min(previewIndex, next.length - 1));
  };

  const movePhoto = async (i: number, d: number) => {
    if (!selected) return;
    const ids = photos.map((p) => p.id);
    const j = i + d;
    if (ids[j] === undefined) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await fetch(`/api/albums/${selected}/photos`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    await select(selected);
  };

  const removeAlbum = async (slug: string) => {
    if (!window.confirm(`Delete album "${slug}" and all its photo links? R2 files stay.`)) return;
    await fetch(`/api/albums/${slug}`, { method: "DELETE" });
    if (selected === slug) {
      closeModal();
    }
    await refresh();
    flash("Album deleted");
  };

  const [coverBusy, setCoverBusy] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const setCover = async (url: string | null) => {
    if (!selected) return;
    setCoverBusy(true);
    const r = await fetch(`/api/albums/${selected}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cover: url }),
    });
    flash(r.ok ? (url ? "Cover updated" : "Cover reset to first photo") : "Cover save failed");
    if (r.ok) await refresh();
    setCoverBusy(false);
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setCoverBusy(true);
    try {
      await setCover(await uploadToR2(file));
    } catch {
      flash("Cover upload failed");
      setCoverBusy(false);
    }
  };

  const active = albums.find((a) => a.slug === selected);

  const setCategory = async (category: "wedding" | "portrait") => {
    if (!selected) return;
    const r = await fetch(`/api/albums/${selected}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category }),
    });
    flash(r.ok ? `Moved to ${category === "portrait" ? "Portraits" : "Weddings"}` : "Move failed");
    if (r.ok) await refresh();
  };

  const toggleFeatured = async () => {
    if (!selected || !active) return;
    const r = await fetch(`/api/albums/${selected}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featured: !active.featured }),
    });
    flash(r.ok ? (!active.featured ? "★ Featured on home" : "Removed from home featured") : "Save failed");
    if (r.ok) await refresh();
  };

  const [info, setInfo] = useState({ title: "", description: "" });
  useEffect(() => {
    const a = albums.find((x) => x.slug === selected);
    setInfo({ title: a?.title ?? "", description: a?.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, albums]);

  const saveInfo = async () => {
    if (!selected) return;
    const r = await fetch(`/api/albums/${selected}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: info.title, description: info.description }),
    });
    flash(r.ok ? "Album info saved" : "Save failed");
    if (r.ok) await refresh();
  };

  return (
    <section
      className={`db-sec db-sec-open db-albums${listDragging ? " db-drop-active" : ""}`}
      onDragEnter={(e) => {
        if (modalOpen) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setListDragging(true);
      }}
      onDragOver={(e) => {
        if (modalOpen) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (modalOpen) return;
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setListDragging(false);
      }}
      onDrop={(e) => {
        if (modalOpen) return;
        if (!e.dataTransfer.types.includes("Files")) return;
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
        <p className="db-albums-hint">
          <strong>Wedding</strong> albums show at <code>/weddings</code> + home Weddings;{" "}
          <strong>Portrait</strong> albums show at <code>/portraits</code> + home Portraits.{" "}
          <strong>★ Featured</strong> albums also show in the home Gallery. Click a cover card to open{" "}
          <code>/weddings/&lt;slug&gt;</code> or <code>/portraits/&lt;slug&gt;</code>.
        </p>

        <div className="db-row" style={{ marginBottom: 10 }}>
          {(["all", "wedding", "portrait"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`db-btn db-btn-sm${filter === f ? " db-btn-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `All (${albums.length})` : f === "wedding" ? `Weddings (${albums.filter((a) => a.category === "wedding").length})` : `Portraits (${albums.filter((a) => a.category === "portrait").length})`}
            </button>
          ))}
        </div>

        <form className="db-albums-new" onSubmit={createAlbum}>
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
            <button type="submit" className="db-btn db-btn-sm" disabled={!form.title.trim()}>
              + Create
            </button>
          </div>
        </form>

        <div className="db-albums-list">
          {albums
            .filter((a) => filter === "all" || a.category === filter)
            .map((a) => (
              <div key={a.slug} className="db-album-row">
                {a.cover && <img className="db-album-thumb" src={a.cover} alt="" loading="lazy" />}
                <button type="button" className="db-album-name" onClick={() => void select(a.slug)} title="Click to edit in popup">
                  {a.featured ? "★ " : ""}[{a.category === "portrait" ? "P" : "W"}] {a.title}{" "}
                  <em className="db-count">{a.count}</em>
                </button>
                <em className="db-album-slug">
                  /{a.category === "portrait" ? "portraits" : "weddings"}/{a.slug}
                </em>
                <button type="button" className="db-btn db-btn-sm" onClick={() => void select(a.slug)}>
                  Edit
                </button>
                <button type="button" className="db-mini db-mini-del" onClick={() => void removeAlbum(a.slug)} aria-label={`Delete ${a.title}`}>
                  ✕
                </button>
              </div>
            ))}
          {albums.filter((a) => filter === "all" || a.category === filter).length === 0 && (
            <p className="db-albums-hint">No albums here yet — create one above.</p>
          )}
        </div>
        <div className={`db-dropzone${listDragging ? " db-dropzone-on" : ""}`}>
          <span>
            {listDragging
              ? "Drop to create gallery — one per folder, named after the folder 📁"
              : "Tip: drag a folder from your PC here — one gallery per folder, auto-named. Or drop files to make a single gallery."}
          </span>
          {uploadProgress && !modalOpen && (
            <span className="db-progress">
              <i style={{ width: `${Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%` }} />
              <em>
                {uploadProgress.done}/{uploadProgress.total}
              </em>
            </span>
          )}
        </div>
        <p className="db-albums-hint">Tip: click a gallery name or Edit to open the popup editor.</p>
      </div>

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
            <div className="db-modal-head">
              <div className="db-modal-title">
                {active.cover && <img className="db-modal-cover" src={active.cover} alt="" />}
                <div>
                  <strong>
                    {active.title} [{active.category === "portrait" ? "Portrait" : "Wedding"}]
                    {active.featured ? " ★" : ""}
                  </strong>
                  <span className="db-modal-sub">
                    /{active.category === "portrait" ? "portraits" : "weddings"}/{active.slug} · {photos.length}{" "}
                    {photos.length === 1 ? "photo" : "photos"} ·{" "}
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
              <div className="db-modal-actions">
                <button
                  type="button"
                  className="db-btn db-btn-sm"
                  onClick={() => void setCategory(active.category === "portrait" ? "wedding" : "portrait")}
                >
                  → Move to {active.category === "portrait" ? "Weddings" : "Portraits"}
                </button>
                <button type="button" className="db-btn db-btn-sm" onClick={() => void toggleFeatured()}>
                  {active.featured ? "☆ Unfeature" : "★ Feature on home"}
                </button>
                <button type="button" className="db-btn db-btn-sm db-btn-primary" onClick={() => void saveInfo()}>
                  Save info
                </button>
                <button type="button" className="db-btn db-btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? "Uploading…" : "⬆ Upload photos"}
                </button>
                <button type="button" className="db-btn db-btn-sm" disabled={busy} onClick={() => folderRef.current?.click()}>
                  {busy ? "Uploading…" : "📁 Upload folder"}
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
                  <i
                    style={{
                      width: `${Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%`,
                    }}
                  />
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
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                  placeholder="Description (shown on gallery page)"
                  aria-label="Gallery description"
                />
              </div>

              <div className="db-cover-row">
                {active.cover && <img className="db-cover-thumb" src={active.cover} alt="Gallery cover" />}
                <div className="db-cover-actions">
                  <strong className="db-label">Cover — first photo is default, ★ on any photo to override</strong>
                  <span className="db-item-actions">
                    <button type="button" className="db-btn db-btn-sm" disabled={coverBusy} onClick={() => coverFileRef.current?.click()}>
                      {coverBusy ? "Working…" : "⬆ Upload cover"}
                    </button>
                    <button type="button" className="db-btn db-btn-sm" disabled={coverBusy || !active.coverUrl} onClick={() => void setCover(null)}>
                      Use first photo
                    </button>
                  </span>
                  <input ref={coverFileRef} type="file" accept="image/*" hidden onChange={(e) => void uploadCover(e.target.files?.[0])} />
                </div>
              </div>

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
                      <button type="button" className="db-mini" disabled={i === 0} onClick={() => void movePhoto(i, -1)} aria-label="Move earlier">↑</button>
                      <button type="button" className="db-mini" disabled={i === photos.length - 1} onClick={() => void movePhoto(i, 1)} aria-label="Move later">↓</button>
                      <button type="button" className={`db-mini ${p.url === active.coverUrl ? "db-mini-cover-on" : ""}`} disabled={coverBusy} title="Set as gallery cover" onClick={() => void setCover(p.url)}>★</button>
                      <button type="button" className="db-mini db-mini-del" onClick={() => void removePhoto(p.id)} aria-label="Remove photo">✕</button>
                    </figcaption>
                  </figure>
                ))}
                {photos.length === 0 && <p className="db-albums-hint">No photos yet — upload above or paste URLs below.</p>}
              </div>

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

              <div className="db-field" style={{ border: "1px dashed var(--db-line)", borderRadius: 8, padding: 10 }}>
                <span className="db-label">Google Drive → R2 import — paste public file or folder link</span>
                <span className="db-albums-hint" style={{ margin: 0 }}>
                  Share in Drive → Anyone with the link → Viewer, then paste here. Subfolders are scanned too. Files are
                  copied into permanent R2 storage — Drive links are never kept, so galleries never break.
                </span>
                {photos.some((p) => p.url.includes("googleusercontent") || p.url.includes("drive.google")) && (
                  <div className="db-row" style={{ marginTop: 6 }}>
                    <span className="db-albums-hint" style={{ margin: 0 }}>
                      ⚠ {photos.filter((p) => p.url.includes("googleusercontent") || p.url.includes("drive.google")).length} old
                      Drive-linked photo(s) will break — move them to R2:
                    </span>
                    <button
                      type="button"
                      className="db-btn db-btn-sm db-btn-primary"
                      disabled={migrateBusy || busy}
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
                  <button type="button" className="db-btn db-btn-sm" disabled={!driveLink.trim() || driveBusy} onClick={() => void resolveDrive()}>
                    {driveBusy ? "Reading…" : "Check Drive"}
                  </button>
                </div>
                {driveProgress && (
                  <span className="db-albums-hint">
                    Copying Drive → R2: {driveProgress.done}/{driveProgress.total}…
                  </span>
                )}
                {driveFiles.length > 0 && (
                  <>
                    <span className="db-albums-hint">
                      {driveKind === "folder" ? "Folder" : "File"} → {driveFiles.length} image{driveFiles.length > 1 ? "s" : ""} ready
                      {driveMeta?.foldersSeen && driveMeta.foldersSeen > 1 ? ` (found across ${driveMeta.foldersSeen} folders)` : ""}
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
                      <button type="button" className="db-btn db-btn-sm db-btn-primary" disabled={busy} onClick={() => void importDrive()}>
                        {busy ? `Copying to R2…${driveProgress ? ` ${driveProgress.done}/${driveProgress.total}` : ""}` : `⇩ Copy ${driveFiles.length} to R2 gallery`}
                      </button>
                      <button
                        type="button"
                        className="db-btn db-btn-sm"
                        onClick={() => {
                          setDriveFiles([]);
                          setDriveLink("");
                          setDriveKind(null);
                          setDriveMeta(null);
                          setDriveProgress(null);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

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
                  onClick={async () => {
                    await saveInfo();
                    closeModal();
                  }}
                >
                  Save &amp; close
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
