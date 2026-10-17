"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editorSections, type FieldDef } from "@/lib/editor-schema";
import { ListField, StringListField, MediaField, TextField, PalettePicker, CropPicker } from "./fields";
import AlbumsPanel from "./AlbumsPanel";
import type { SiteContent } from "@/lib/content";
import "@/app/admin/dashboard.css";

type Content = SiteContent & Record<string, unknown>;

function setIn(obj: Content, path: string, value: unknown): Content {
  const keys = path.split(".");
  const clone = structuredClone(obj);
  let cur = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
  return clone;
}

function getIn(obj: Content, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export default function Dashboard({ site }: { site: string }) {
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [baseline, setBaseline] = useState<Content | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [msg, setMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [previewKey, setPreviewKey] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>("brand");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const dirty = useMemo(
    () => !!content && !!baseline && JSON.stringify(content) !== JSON.stringify(baseline),
    [content, baseline]
  );

  useEffect(() => {
    fetch(`/api/sites/${site}/content`)
      .then(async (r) => {
        if (r.status === 401) {
          setStatus("unauthorized");
          router.replace(`/admin/login?next=/admin/${site}`);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { content: Content };
        setContent(d.content);
        setBaseline(d.content);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [site, router]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const save = useCallback(async () => {
    if (!content) return;
    setSaveState("saving");
    try {
      const r = await fetch(`/api/sites/${site}/content`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) {
        setSaveState("idle");
        flash(`Save failed (${r.status})`);
        return;
      }
      setBaseline(structuredClone(content));
      setSaveState("saved");
      // Push straight into the draft iframe — instant, no reload, keeps scroll.
      const frame = frameRef.current?.contentWindow;
      if (frame) frame.postMessage({ type: "pk-preview", content }, window.location.origin);
      else setPreviewKey(Date.now());
    } catch {
      setSaveState("idle");
      flash("Save failed — network");
    }
  }, [content, site]);

  // Debounced autosave: preview follows every edit ~700ms after typing pauses.
  useEffect(() => {
    if (!dirty || status !== "ready") return;
    const t = setTimeout(() => void save(), 700);
    return () => clearTimeout(t);
  }, [dirty, status, save]);

  const publish = useCallback(async () => {
    if (dirty) await save();
    const r = await fetch(`/api/sites/${site}/publish`, { method: "POST" });
    flash(r.ok ? "Published live ✓" : "Publish failed");
  }, [dirty, save, site]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  // Arrange mode: tell the preview iframe reels are draggable; receive drops.
  const [arrange, setArrange] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage({ type: "pk-edit", on: arrange }, window.location.origin);
    }, 150);
    return () => clearTimeout(t);
  }, [arrange, previewKey]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as {
        type?: string;
        index?: number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        items?: { i: number; x: number; y: number; w: number; h: number }[];
        boxH?: number;
        ratio?: number;
        rotate?: boolean;
      };
      if (d?.type === "pk-reel-pos" && d.index != null && d.x != null && d.y != null && d.w != null && d.h != null) {
        setContent((c) => {
          if (!c) return c;
          return setIn(structuredClone(c), `theater.reels.${d.index}`, {
            ...((getIn(c, `theater.reels.${d.index}`) as Record<string, unknown>) ?? {}),
            x: d.x,
            y: d.y,
            w: d.w,
            h: d.h,
          });
        });
      }
      if (d?.type === "pk-reel-rot" && d.index != null && typeof d.rotate === "number") {
        setContent((c) => {
          if (!c) return c;
          const reel = getIn(c, `theater.reels.${d.index}`) as Record<string, unknown> | undefined;
          if (!reel) return c;
          return setIn(structuredClone(c), `theater.reels.${d.index}`, { ...reel, rotate: d.rotate });
        });
      }
      if (d?.type === "pk-reel-snap" && d.items?.length) {
        setContent((c) => {
          if (!c) return c;
          let next = structuredClone(c);
          for (const it of d.items!) {
            const reel = getIn(next, `theater.reels.${it.i}`) as Record<string, unknown> | undefined;
            if (!reel || typeof reel.x === "number") continue; // keep already-placed reels as-is
            next = setIn(next, `theater.reels.${it.i}`, { ...reel, x: it.x, y: it.y, w: it.w, h: it.h });
          }
          if (d.boxH) next = setIn(next, "theater.canvasH", d.boxH);
          if (d.ratio) next = setIn(next, "theater.canvasRatio", d.ratio);
          return next;
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (status === "loading" || status === "unauthorized") {
    return <div className="db-center">Loading dashboard…</div>;
  }
  if (status === "error" || !content) {
    return <div className="db-center">Could not load content. <a href={`/admin/login`}>Log in again</a></div>;
  }

  const onChange = (path: string, value: unknown) => setContent((c) => (c ? setIn(c, path, value) : c));

  return (
    <div className="db-root">
      <header className="db-bar">
        <div className="db-bar-left">
          <strong>{String((content.branding as Record<string, unknown>)?.logoName ?? site)}</strong>
          <span className="db-dim">/ {site}</span>
          {dirty ? <span className="db-badge">{saveState === "saving" ? "saving…" : "unsaved"}</span> : saveState === "saved" ? <span className="db-badge db-badge-ok">saved ✓</span> : null}
          {msg && <span className="db-msg">{msg}</span>}
        </div>
        <div className="db-bar-right">
          <button
            type="button"
            className={`db-btn ${arrange ? "db-btn-arrange-on" : ""}`}
            onClick={() => setArrange((a) => !a)}
            title="Drag theater reels to any position right in the preview"
          >
            {arrange ? "✓ Done arranging" : "✋ Arrange reels"}
          </button>
          <a className="db-btn" href={`/${site}`} target="_blank" rel="noreferrer">Open live site</a>
          <button type="button" className="db-btn" onClick={() => void save()} disabled={!dirty}>Save draft</button>
          <button type="button" className="db-btn db-btn-primary" onClick={() => void publish()}>Publish</button>
          <button type="button" className="db-btn db-btn-ghost" onClick={() => void logout()}>Log out</button>
        </div>
      </header>

      <div className="db-body">
        <div className={`db-preview ${device === "mobile" ? "db-preview-mobile" : ""}`}>
          <div className="db-device-bar" role="group" aria-label="Preview size">
            <button type="button" className={`db-dev-btn ${device === "desktop" ? "on" : ""}`} onClick={() => setDevice("desktop")}>
              Desktop
            </button>
            <button type="button" className={`db-dev-btn ${device === "mobile" ? "on" : ""}`} onClick={() => setDevice("mobile")}>
              Mobile
            </button>
            <span className="db-dev-size">{device === "mobile" ? "390 × 844" : "full width"}</span>
          </div>
          <div className="db-device-stage">
            <iframe
              ref={frameRef}
              className="db-frame"
              title="Site preview (draft)"
              src={`/${site}?draft=1&t=${previewKey}`}
            />
          </div>
        </div>

        <aside className="db-editor" aria-label="Content editor">
          {editorSections.map((sec) => {
            const isOpen = open === sec.id;
            return (
              <section key={sec.id} className={`db-sec ${isOpen ? "db-sec-open" : ""}`}>
                <button type="button" className="db-sec-head" onClick={() => setOpen(isOpen ? null : sec.id)}>
                  <span>{sec.title}</span>
                  <span className="db-chev">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && (
                  <div className="db-sec-body">
                    {sec.fields.map((f: FieldDef) =>
                      f.type === "list" ? (
                        <ListField key={`${f.path}:${f.type}`} def={f} value={(getIn(content, f.path) as Record<string, unknown>[]) ?? []} onChange={(v) => onChange(f.path, v)} />
                      ) : f.type === "stringList" ? (
                        <StringListField key={`${f.path}:${f.type}`} def={f} value={(getIn(content, f.path) as string[]) ?? []} onChange={(v) => onChange(f.path, v)} />
                      ) : f.type === "palette" ? (
                        <PalettePicker key={`${f.path}:${f.type}`} value={String(getIn(content, f.path) ?? "pelli-classic")} onChange={(v) => onChange(f.path, v)} />
                      ) : f.type === "image" || f.type === "video" ? (
                        <div key={`${f.path}:${f.type}`} className="db-field-group">
                          <MediaField label={f.label} kind={f.type} value={String(getIn(content, f.path) ?? "")} onChange={(v) => onChange(f.path, v)} />
                          {f.type === "image" && (
                            <CropPicker
                              imgUrl={String(getIn(content, f.path) ?? "")}
                              value={String(getIn(content, `${f.path}Crop`) ?? "")}
                              onChange={(v) => onChange(`${f.path}Crop`, v)}
                            />
                          )}
                        </div>
                      ) : (
                        <TextField key={`${f.path}:${f.type}`} label={f.label} value={String(getIn(content, f.path) ?? "")} textarea={f.type === "textarea"} onChange={(v) => onChange(f.path, v)} />
                      )
                    )}
                  </div>
                )}
              </section>
            );
          })}
          <AlbumsPanel />
          <p className="db-foot-note">
            Album photos live in R2; links are stored in Turso. Every album automatically appears as a
            cover card in the site&apos;s Weddings section.
          </p>
        </aside>
      </div>
    </div>
  );
}
