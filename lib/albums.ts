import { getDb } from "./db";

export type AlbumCategory = "wedding" | "portrait";

export type AlbumRow = {
  id: number;
  slug: string;
  title: string;
  couple: string | null;
  description: string | null;
  count: number;
  cover: string | null; // effective cover: custom cover_url, else first photo
  coverUrl: string | null; // raw admin-chosen cover
  category: AlbumCategory;
  featured: boolean;
};

export type PhotoRow = { id: number; url: string; caption: string | null; sort: number };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function listAlbums(filter?: {
  category?: AlbumCategory;
  featuredOnly?: boolean;
  hideEmpty?: boolean;
}): Promise<AlbumRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter?.category) {
    where.push("a.category = ?");
    args.push(filter.category);
  }
  if (filter?.featuredOnly) {
    where.push("a.featured = 1");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const r = await getDb().execute(
    `SELECT a.id, a.slug, a.title, a.couple, a.description,
            COALESCE(a.category, 'wedding') AS category,
            COALESCE(a.featured, 0) AS featured,
            (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS count,
            a.cover_url,
            COALESCE(a.cover_url, (SELECT p.url FROM photos p WHERE p.album_id = a.id ORDER BY p.sort, p.id LIMIT 1)) AS cover
     FROM albums a ${whereSql} ORDER BY a.featured DESC, a.id DESC`,
    args as never[]
  );
  return r.rows
    .map((x) => ({
      id: Number(x.id),
      slug: String(x.slug),
      title: String(x.title),
      couple: x.couple == null ? null : String(x.couple),
      description: x.description == null ? null : String(x.description),
      count: Number(x.count),
      cover: x.cover == null ? null : String(x.cover),
      coverUrl: x.cover_url == null ? null : String(x.cover_url),
      category: (x.category === "portrait" ? "portrait" : "wedding") as AlbumCategory,
      featured: Number(x.featured) === 1,
    }))
    // Empty (0-photo) albums are drafts/tests — never show them publicly.
    .filter((a) => !filter?.hideEmpty || a.count > 0);
}

export async function listFeatured(category?: AlbumCategory): Promise<AlbumRow[]> {
  return listAlbums({ category, featuredOnly: true });
}

export async function getAlbumBySlug(slug: string, category?: AlbumCategory): Promise<AlbumRow | null> {
  const all = await listAlbums(category ? { category } : undefined);
  return all.find((a) => a.slug === slug) ?? null;
}

export async function createAlbum(input: {
  slug: string;
  title: string;
  couple?: string;
  description?: string;
  category?: AlbumCategory;
  featured?: boolean;
}): Promise<AlbumRow | { error: string }> {
  const db = getDb();
  const exists = await db.execute({ sql: "SELECT id FROM albums WHERE slug = ?", args: [input.slug] });
  if (exists.rows.length > 0) return { error: "slug already exists" };
  await db.execute({
    sql: "INSERT INTO albums (slug, title, couple, description, category, featured) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      input.slug,
      input.title,
      input.couple ?? null,
      input.description ?? null,
      input.category ?? "wedding",
      input.featured ? 1 : 0,
    ],
  });
  return (await getAlbumBySlug(input.slug))!;
}

export async function updateAlbum(
  slug: string,
  patch: {
    title?: string;
    couple?: string;
    description?: string;
    cover?: string | null;
    category?: AlbumCategory;
    featured?: boolean;
  }
): Promise<boolean> {
  const db = getDb();
  const album = await getAlbumBySlug(slug);
  if (!album) return false;
  await db.execute({
    sql: "UPDATE albums SET title = ?, couple = ?, description = ?, cover_url = ?, category = ?, featured = ? WHERE id = ?",
    args: [
      patch.title ?? album.title,
      patch.couple ?? album.couple,
      patch.description ?? album.description,
      patch.cover === undefined ? album.coverUrl : patch.cover,
      patch.category ?? album.category,
      patch.featured === undefined ? (album.featured ? 1 : 0) : patch.featured ? 1 : 0,
      album.id,
    ],
  });
  return true;
}

export async function deleteAlbum(slug: string): Promise<boolean> {
  const db = getDb();
  const album = await getAlbumBySlug(slug);
  if (!album) return false;
  await db.batch(
    [
      { sql: "DELETE FROM photos WHERE album_id = ?", args: [album.id] },
      { sql: "DELETE FROM albums WHERE id = ?", args: [album.id] },
    ],
    "write"
  );
  return true;
}

export async function listPhotos(albumSlug: string): Promise<PhotoRow[]> {
  const album = await getAlbumBySlug(albumSlug);
  if (!album) return [];
  const r = await getDb().execute({
    sql: "SELECT id, url, caption, sort FROM photos WHERE album_id = ? ORDER BY sort, id",
    args: [album.id],
  });
  return r.rows.map((x) => ({
    id: Number(x.id),
    url: String(x.url),
    caption: x.caption == null ? null : String(x.caption),
    sort: Number(x.sort),
  }));
}

export async function addPhotos(albumSlug: string, urls: string[]): Promise<number> {
  const db = getDb();
  const album = await getAlbumBySlug(albumSlug);
  if (!album) return 0;
  const maxRow = await db.execute({ sql: "SELECT COALESCE(MAX(sort), -1) AS m FROM photos WHERE album_id = ?", args: [album.id] });
  let sort = Number(maxRow.rows[0].m) + 1;
  for (const url of urls) {
    await db.execute({ sql: "INSERT INTO photos (album_id, url, sort) VALUES (?, ?, ?)", args: [album.id, url, sort++] });
  }
  return urls.length;
}

export async function deletePhoto(photoId: number): Promise<boolean> {
  const r = await getDb().execute({ sql: "DELETE FROM photos WHERE id = ?", args: [photoId] });
  return r.rowsAffected > 0;
}

export async function reorderPhotos(albumSlug: string, ids: number[]): Promise<boolean> {
  const db = getDb();
  const album = await getAlbumBySlug(albumSlug);
  if (!album) return false;
  const stmts = ids.map((id, i) => ({
    sql: "UPDATE photos SET sort = ? WHERE id = ? AND album_id = ?",
    args: [i, id, album.id],
  }));
  if (stmts.length) await db.batch(stmts, "write");
  return true;
}
