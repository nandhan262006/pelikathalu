import { getDb, withRetry } from "./db";
import { defaultContent, mergeContent, type SiteContent } from "./content";

export async function getSiteContent(slug: string, draft: boolean): Promise<SiteContent | null> {
  try {
    return await withRetry(async () => {
      const db = getDb();
      const r = await db.execute({
        sql: `SELECT c.${draft ? "draft_json" : "published_json"} AS json
              FROM sites s JOIN content c ON c.site_id = s.id
              WHERE s.slug = ?`,
        args: [slug],
      });
      if (r.rows.length === 0) return null;
      const raw = r.rows[0].json;
      if (typeof raw !== "string" || raw === "") return mergeContent({});
      try {
        return mergeContent(JSON.parse(raw));
      } catch {
        return mergeContent({});
      }
    });
  } catch (e) {
    // Public site must not 500 on a Turso blip: fall back to defaults.
    // Draft preview surfaces the error so the dashboard can retry.
    if (draft) throw e;
    console.error(`[sites] Turso unreachable for "${slug}" — serving defaults:`, e instanceof Error ? e.message : e);
    return mergeContent({});
  }
}

export async function saveDraft(slug: string, content: SiteContent): Promise<boolean> {
  return withRetry(() =>
    getDb().execute({
      sql: `UPDATE content SET draft_json = ?, updated_at = datetime('now')
          WHERE site_id = (SELECT id FROM sites WHERE slug = ?)`,
      args: [JSON.stringify(content), slug],
    })
  ).then((r) => r.rowsAffected > 0);
}

export async function publishSite(slug: string): Promise<boolean> {
  return withRetry(() =>
    getDb().execute({
      sql: `UPDATE content SET published_json = draft_json, updated_at = datetime('now')
          WHERE site_id = (SELECT id FROM sites WHERE slug = ?)`,
      args: [slug],
    })
  ).then((r) => r.rowsAffected > 0);
}
