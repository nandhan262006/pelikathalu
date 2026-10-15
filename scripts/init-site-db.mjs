import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { defaultContent } from "../lib/content.ts";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.batch(
  [
    {
      sql: `CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        owner TEXT,
        theme TEXT DEFAULT 'green',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS content (
        site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
        draft_json TEXT NOT NULL DEFAULT '',
        published_json TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    },
  ],
  "write"
);

const json = JSON.stringify(defaultContent);
await db.execute({
  sql: `INSERT INTO sites (slug, owner) VALUES (?, ?)
        ON CONFLICT(slug) DO NOTHING`,
  args: ["home", "prempavan"],
});
const siteId = Number((await db.execute("SELECT id FROM sites WHERE slug = 'home'")).rows[0].id);
await db.execute({
  sql: `INSERT INTO content (site_id, draft_json, published_json)
        VALUES (?, ?, ?)
        ON CONFLICT(site_id) DO NOTHING`,
  args: [siteId, json, json],
});

console.log(`site 'home' ready (id ${siteId}); draft+published seeded with defaults`);
