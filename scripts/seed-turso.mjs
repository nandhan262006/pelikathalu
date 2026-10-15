import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { readdirSync } from "node:fs";
import { join } from "node:path";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const R2 = process.env.NEXT_PUBLIC_R2_URL;

await db.batch(
  [
    {
      sql: `CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        couple TEXT,
        description TEXT,
        cover_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        caption TEXT,
        sort INTEGER DEFAULT 0
      )`,
    },
  ],
  "write"
);

const files = readdirSync("/tmp/opencode/drive-images-web")
  .filter((f) => f.endsWith(".jpg"))
  .sort((a, b) => {
    const n = (s) => (s.match(/ITW(\d+)/) || [, "999999"])[1];
    return Number(n(a)) - Number(n(b)) || a.localeCompare(b);
  });

await db.execute({
  sql: `INSERT INTO albums (slug, title, couple, description)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET title=excluded.title, couple=excluded.couple, description=excluded.description
        RETURNING id`,
  args: [
    "aishwarya-lokesh",
    "Aishwarya + Lokesh",
    "Aishwarya & Lokesh",
    "Their whole day, frame by frame.",
  ],
});

const albumRow = await db.execute({ sql: "SELECT id FROM albums WHERE slug = ?", args: ["aishwarya-lokesh"] });
const albumId = Number(albumRow.rows[0].id);

await db.execute({ sql: "DELETE FROM photos WHERE album_id = ?", args: [albumId] });
for (let i = 0; i < files.length; i++) {
  await db.execute({
    sql: "INSERT INTO photos (album_id, url, sort) VALUES (?, ?, ?)",
    args: [albumId, `${R2}/images/web/${encodeURIComponent(files[i])}`, i],
  });
}

const countRes = await db.execute({ sql: "SELECT COUNT(*) AS c FROM photos WHERE album_id = ?", args: [albumId] });
console.log(`seeded album #${albumId} with ${countRes.rows[0].c} photos`);
