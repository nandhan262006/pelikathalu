"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadToR2 } from "./fields";

type Album = { id: number; slug: string; title: string; couple: string | null; description: string | null; count: number; cover: string | null; coverUrl: string | null };
type Photo = { id: number; url: string; caption: string | null; sort: number };

export default function AlbumsPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", couple: "", description: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteUrls, setPasteUrls] = useState("");

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
    const r = await fetch(`/api/albums/${slug}/photos`);
    if (r.ok) setPhotos(((await r.json()) as { photos: Photo[] }).photos);
    else setPhotos([]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const r = await fetch("/api/albums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.status === 409) return flash("That slug already exists");
    if (!r.ok) return flash("Create failed");
    const d = (await r.json()) as { album: Album };
    setForm({ title: "", couple: "", description: "" });
    await refresh();
    void select(d.album.slug);
    flash("Album created");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !selected) return;
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      try {
        urls.push(await uploadToR2(f));
      } catch {
        flash(`Upload failed for ${f.name}`);
      }
    }
    if (urls.length) {
      const r = await fetch(`/api/albums/${selected}/photos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (r.ok) {
        flash(`Added ${urls.length} photo${urls.length > 1 ? "s" : ""}`);
        await select(selected);
        await refresh();
      } else flash("Failed to attach photos");
    }
    setBusy(false);
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
    }
  };

  const removePhoto = async (id: number) => {
    if (!selected) return;
    await fetch(`/api/albums/${selected}/photos/${id}`, { method: "DELETE" });
    await select(selected);
    await refresh();
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
      setSelected(null);
      setPhotos([]);
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
    <section className="db-sec db-sec-open db-albums">
      <div className="db-sec-head db-albums-head">
        <span>Wedding Albums</span>
        {msg && <em className="db-albums-msg">{msg}</em>}
      </div>
      <div className="db-sec-body">
        <p className="db-albums-hint">
          Every album shows as a cover card in the site&apos;s <strong>Weddings</strong> section; clicking it opens
          the full gallery at <code>/weddings/&lt;slug&gt;</code>. The first photo is the cover.
        </p>

        <form className="db-albums-new" onSubmit={createAlbum}>
          <input
            className="db-input"
            placeholder="Couple title — e.g. Priya + Arjun"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="db-row">
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
          {albums.map((a) => (
            <div key={a.slug} className={`db-album-row ${selected === a.slug ? "db-album-active" : ""}`}>
              <button type="button" className="db-album-name" onClick={() => void select(a.slug)}>
                {a.title} <em className="db-count">{a.count}</em>
              </button>
              <em className="db-album-slug">{a.slug}</em>
              <button type="button" className="db-mini db-mini-del" onClick={() => void removeAlbum(a.slug)} aria-label={`Delete ${a.title}`}>
                ✕
              </button>
            </div>
          ))}
          {albums.length === 0 && <p className="db-albums-hint">No albums yet — create one above.</p>}
        </div>

        {active && (
          <div className="db-album-manage">
            <div className="db-album-manage-head">
              <strong>Managing: {active.title}</strong>
              <span className="db-item-actions">
                <button type="button" className="db-btn db-btn-sm" onClick={() => void saveInfo()}>
                  Save info
                </button>
                <button type="button" className="db-btn db-btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? "Uploading…" : "⬆ Upload photos"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden multiple onChange={(e) => void uploadFiles(e.target.files)} />
              </span>
            </div>

            <div className="db-cover-row">
              {active.cover && <img className="db-cover-thumb" src={active.cover} alt="Album cover" />}
              <div className="db-cover-actions">
                <strong className="db-label">Cover</strong>
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

            <div className="db-row">
              <input
                className="db-input"
                value={info.title}
                onChange={(e) => setInfo({ ...info, title: e.target.value })}
                placeholder="Album title"
              />
              <input
                className="db-input"
                value={info.description}
                onChange={(e) => setInfo({ ...info, description: e.target.value })}
                placeholder="Description (shown on album page)"
              />
            </div>

            <div className="db-album-grid">
              {photos.map((p, i) => (
                <figure key={p.id} className="db-album-photo">
                  <img src={p.url} alt="" loading="lazy" />
                  <figcaption>
                    <button type="button" className="db-mini" disabled={i === 0} onClick={() => void movePhoto(i, -1)} aria-label="Move earlier">↑</button>
                    <button type="button" className="db-mini" disabled={i === photos.length - 1} onClick={() => void movePhoto(i, 1)} aria-label="Move later">↓</button>
                    <button type="button" className={`db-mini ${p.url === active.coverUrl ? "db-mini-cover-on" : ""}`} disabled={coverBusy} title="Set as album cover" onClick={() => void setCover(p.url)}>★</button>
                    <button type="button" className="db-mini db-mini-del" onClick={() => void removePhoto(p.id)} aria-label="Remove photo">✕</button>
                  </figcaption>
                </figure>
              ))}
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
          </div>
        )}
      </div>
    </section>
  );
}
