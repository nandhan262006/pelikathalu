"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { FieldDef } from "@/lib/editor-schema";
import { allPalettes } from "@/lib/palettes";
import { fontKits } from "@/lib/fonts";

export async function uploadToR2(file: File): Promise<string> {
  // Guard the upload slot before asking for a presigned URL.
  if (file.size > 250 * 1024 * 1024) {
    throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(0)}MB — over the 250MB limit`);
  }
  const metaRes = await fetch("/api/r2/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, filename: file.name }),
  });
  if (!metaRes.ok) {
    let msg = `upload-url ${metaRes.status}`;
    try {
      const j = (await metaRes.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* keep generic */
    }
    throw new Error(msg);
  }
  const meta = (await metaRes.json()) as { uploadUrl: string; publicUrl: string; contentType?: string };
  const putType = meta.contentType || file.type || "application/octet-stream";
  const put = await fetch(meta.uploadUrl, { method: "PUT", headers: { "content-type": putType }, body: file });
  if (!put.ok) {
    let detail = await put.text().catch(() => "");
    try {
      const j = JSON.parse(detail) as { message?: string };
      if (j.message) detail = j.message;
    } catch {
      detail = detail.slice(0, 120);
    }
    throw new Error(`R2 upload ${put.status}${detail ? `: ${detail}` : ""}`);
  }
  // HEIC/TIFF bytes are undisplayable in Chrome/Firefox — ask the server to
  // convert the stored object to a display JPEG. Best-effort: keep the
  // original link if conversion fails.
  const stored = (meta.contentType || file.type || "").toLowerCase();
  if (/heic|heif|tiff/.test(stored)) {
    try {
      const c = await fetch("/api/r2/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: meta.publicUrl }),
      });
      if (c.ok) {
        const d = (await c.json()) as { publicUrl?: string };
        if (d.publicUrl) return d.publicUrl;
      }
    } catch {
      /* fall through with the original url */
    }
  }
  return meta.publicUrl;
}

export function TextField({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="db-field">
      <span className="db-label">{label}</span>
      {textarea ? (
        <textarea className="db-input db-textarea" rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="db-input" type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function SwitchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="db-field">
      <span className="db-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`db-btn db-btn-sm${value ? " db-btn-arrange-on" : ""}`}
        onClick={() => onChange(!value)}
      >
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="db-field">
      <span className="db-label">
        {label} <em className="db-count">{Math.round(value)}%</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function RotateButton({ deg, onStep }: { deg: number; onStep: (deg: number) => void }) {
  const next = (deg + 90) % 360;
  return (
    <button
      type="button"
      className={`db-btn db-btn-sm${deg ? " db-btn-arrange-on" : ""}`}
      onClick={() => onStep(next)}
      title="Rotate the video 90° clockwise — click again for 180°, then 270°, then back to 0°"
    >
      {deg ? `⟳ ${deg}° — rotate to ${next}°` : "⟳ Rotate 90°"}
    </button>
  );
}

export function MediaField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind: "image" | "video";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await uploadToR2(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  // Paste a public Drive link → server copies the bytes to R2 (reel/video or image).
  const importDrive = async () => {
    const link = driveLink.trim();
    if (!link) return;
    setDriveBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/drive/copy-one", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const d = (await r.json()) as { publicUrl?: string; error?: string };
      if (!r.ok || !d.publicUrl) throw new Error(d.error ?? "Drive copy failed");
      onChange(d.publicUrl);
      setDriveLink("");
      setDriveOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Drive copy failed");
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <label className="db-field">
      <span className="db-label">{label}</span>
      {kind === "video" ? (
        <div className="db-media">
          {value && <video className="db-thumb" src={value} muted />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="db-btn db-btn-sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload file"}
            </button>
            <button
              type="button"
              className="db-btn db-btn-sm"
              disabled={driveBusy || busy}
              onClick={() => setDriveOpen((o) => !o)}
            >
              {driveBusy ? "Copying…" : "Import from Drive"}
            </button>
            {value && (
              <button
                type="button"
                className="db-mini db-mini-del"
                onClick={() => onChange("")}
                aria-label="Clear video"
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
          {driveOpen && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="db-input"
                type="text"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void importDrive();
                  }
                }}
                placeholder="Paste public Drive link (Anyone with the link → Viewer)"
                aria-label="Google Drive link"
              />
              <button
                type="button"
                className="db-btn db-btn-sm"
                disabled={driveBusy || !driveLink.trim()}
                onClick={() => void importDrive()}
              >
                Copy to R2
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // allow re-picking the same file later
              void pick(f);
            }}
          />
        </div>
      ) : (
        <div className="db-media">
          {value && <img className="db-thumb" src={value} alt="" loading="lazy" />}
          <input className="db-input" type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={`/images/… or R2 URL`} />
          <button
            type="button"
            className="db-btn db-btn-sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // allow re-picking the same file later
              void pick(f);
            }}
          />
        </div>
      )}
      {err && <span className="db-err">{err}</span>}
    </label>
  );
}

export function CropPicker({
  imgUrl,
  value,
  onChange,
  aspect = "3 / 4",
}: {
  imgUrl: string;
  value?: string; // stored as "50% 25%" (CSS background-position); empty = site default
  onChange: (v: string) => void;
  aspect?: string;
}) {
  const m = /(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/.exec(value ?? "");
  const x = m ? parseFloat(m[1]) : 50;
  const y = m ? parseFloat(m[2]) : 50;
  const set = (nx: number, ny: number) => onChange(`${Math.round(Math.min(100, Math.max(0, nx)))}% ${Math.round(Math.min(100, Math.max(0, ny)))}%`);
  const dragging = useRef<DOMRect | null>(null);

  const pos = (e: RPointerEvent<HTMLDivElement>) => {
    const r = dragging.current;
    if (!r) return;
    set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <div className="db-field">
      <div className="db-label-row">
        <span className="db-label">Crop focus</span>
        {value && (
          <button type="button" className="db-mini" onClick={() => onChange("")} aria-label="Reset crop">
            ↺
          </button>
        )}
      </div>
      <div
        className={`db-crop-stage${imgUrl ? "" : " db-crop-empty"}`}
        style={{ aspectRatio: aspect, backgroundImage: imgUrl ? `url("${imgUrl}")` : undefined, backgroundPosition: `${x}% ${y}%` }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          dragging.current = el.getBoundingClientRect();
          const r = dragging.current;
          set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        }}
        onPointerMove={pos}
        onPointerUp={(e) => {
          dragging.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        role="slider"
        aria-label="Crop focus position"
        aria-valuetext={`${Math.round(x)}% ${Math.round(y)}%`}
        tabIndex={0}
        onKeyDown={(e) => {
          const s = e.shiftKey ? 10 : 3;
          if (e.key === "ArrowLeft") set(x - s, y);
          else if (e.key === "ArrowRight") set(x + s, y);
          else if (e.key === "ArrowUp") set(x, y - s);
          else if (e.key === "ArrowDown") set(x, y + s);
          else return;
          e.preventDefault();
        }}
      >
        <span className="db-crop-dot" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
      <span className="db-dim">Drag inside the frame to keep faces in shot — saved as {Math.round(x)}% {Math.round(y)}%.</span>
    </div>
  );
}

export function PalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = allPalettes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="db-field">
      <span className="db-label">
        Site palette <em className="db-count">{value}</em>
      </span>
      <input className="db-input" type="text" placeholder="Search 101 palettes…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="db-pal-grid">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`db-pal ${p.id === value ? "db-pal-on" : ""}`}
            onClick={() => onChange(p.id)}
            title={p.name}
          >
            <span className="db-pal-swatches">
              {[p.bg, p.surface, p.primary, p.accent, p.text].map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <span className="db-pal-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="db-field">
      <span className="db-label">
        Site fonts <em className="db-count">{value}</em>
      </span>
      <div className="db-pal-grid">
        {fontKits.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`db-pal ${k.id === value ? "db-pal-on" : ""}`}
            onClick={() => onChange(k.id)}
            title={k.name}
          >
            <span className="db-font-preview" style={{ fontFamily: k.serif }}>
              Pelli Kathalu
            </span>
            <span className="db-font-preview" style={{ fontFamily: k.script }}>
              how it felt
            </span>
            <span className="db-font-preview" style={{ fontFamily: k.sans, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {k.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  title,
  fields,
  item,
  onUpdate,
  onRemove,
  onMove,
  first,
  last,
}: {
  title: string;
  fields: FieldDef[];
  item: Record<string, unknown>;
  onUpdate: (key: string, v: unknown) => void;
  onRemove: () => void;
  onMove: (d: number) => void;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="db-item">
      <div className="db-item-head">
        <strong>{title}</strong>
        <span className="db-item-actions">
          <button type="button" className="db-mini" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button type="button" className="db-mini" disabled={last} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <button type="button" className="db-mini db-mini-del" onClick={onRemove} aria-label="Remove">✕</button>
        </span>
      </div>
      {fields.map((f) =>
        f.type === "toggle" ? (
          <div key={f.path} className="db-field-group">
            <RotateButton
              deg={
                typeof item[f.path] === "number"
                  ? ((Math.round(item[f.path] as number) % 360) + 360) % 360
                  : item[f.path]
                    ? 90
                    : 0
              }
              onStep={(d) => onUpdate(f.path, d)}
            />
          </div>
        ) : f.type === "stringList" ? (
          <StringListField
            key={f.path}
            def={f}
            value={(item[f.path] as string[]) ?? []}
            onChange={(v) => onUpdate(f.path, v)}
          />
        ) : f.type === "list" ? (
          <ListField
            key={f.path}
            def={f}
            value={(item[f.path] as Record<string, unknown>[]) ?? []}
            onChange={(v) => onUpdate(f.path, v)}
          />
        ) : f.type === "image" || f.type === "video" ? (
          <div key={f.path} className="db-field-group">
            <MediaField
              label={f.label}
              kind={f.type}
              value={String(item[f.path] ?? "")}
              onChange={(v) => onUpdate(f.path, v)}
            />
            {f.type === "image" && (
              <CropPicker
                imgUrl={String(item[f.path] ?? "")}
                value={String(item[`${f.path}Crop`] ?? "")}
                onChange={(v) => onUpdate(`${f.path}Crop`, v)}
              />
            )}
          </div>
        ) : (
          <TextField
            key={f.path}
            label={f.label}
            value={String(item[f.path] ?? "")}
            textarea={f.type === "textarea"}
            onChange={(v) => onUpdate(f.path, v)}
          />
        )
      )}
    </div>
  );
}

export function ListField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const set = (i: number, patch: Record<string, unknown>) =>
    onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, d: number) => {
    const next = [...value];
    const j = i + d;
    if (next[j] === undefined) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="db-field">
      <span className="db-label">
        {def.label} <em className="db-count">{value.length}</em>
      </span>
      {value.map((item, i) => (
        <ItemCard
          key={i}
          title={`${def.label} ${i + 1}`}
          fields={def.itemFields ?? []}
          item={item}
          first={i === 0}
          last={i === value.length - 1}
          onUpdate={(k, v) => set(i, { [k]: v })}
          onRemove={() => remove(i)}
          onMove={(d) => move(i, d)}
        />
      ))}
      <button type="button" className="db-btn db-btn-add" onClick={() => onChange([...value, (def.empty?.() ?? {}) as Record<string, unknown>])}>
        + Add {def.label.replace(/s$/, "")}
      </button>
    </div>
  );
}

export function StringListField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const kind = def.itemField?.type === "image" ? ("image" as const) : null;
  return (
    <div className="db-field">
      <span className="db-label">
        {def.label} <em className="db-count">{value.length}</em>
      </span>
      {value.map((s, i) => (
        <div key={i} className="db-row">
          {kind ? (
            <MediaField label={`${def.label} ${i + 1}`} kind={kind} value={s} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
          ) : (
            <input className="db-input" type="text" value={s} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <span className="db-item-actions">
            <button type="button" className="db-mini" disabled={i === 0} onClick={() => { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} aria-label="Move up">↑</button>
            <button type="button" className="db-mini" disabled={i === value.length - 1} onClick={() => { const n = [...value]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); }} aria-label="Move down">↓</button>
            <button type="button" className="db-mini db-mini-del" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </span>
        </div>
      ))}
      <button type="button" className="db-btn db-btn-add" onClick={() => onChange([...value, ""])}>
        + Add
      </button>
    </div>
  );
}
