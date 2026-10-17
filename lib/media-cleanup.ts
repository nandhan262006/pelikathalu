import { getR2Config, parseManagedR2Key, deleteR2Object } from "./r2";
import { referencedUrls } from "./albums";

const CONC = 6;

export type CleanupResult = { deleted: number; kept: number; failed: number };

/**
 * Cascade delete for R2 objects. A file is removed only when:
 *   1. its key is dashboard-managed (images/uploads, videos/uploads, images/drive,
 *      videos/drive) — pre-existing assets like images/web/* are never touched;
 *   2. no other photo row, album cover, or site content (draft/published)
 *      still references the URL.
 * Dedupes by key; CONC deletes at a time; failures are counted, never thrown.
 */
export async function cascadeDeleteR2(
  urls: (string | null | undefined)[],
  exclude?: { albumSlug?: string; photoId?: number }
): Promise<CleanupResult> {
  const cfg = getR2Config();
  const candidates = new Map<string, { key: string; url: string }>();
  for (const u of urls) {
    if (!u) continue;
    const key = parseManagedR2Key(u, cfg);
    if (key && !candidates.has(key)) {
      candidates.set(key, { key, url: u.split("?")[0] });
    }
  }
  if (!cfg || !candidates.size) return { deleted: 0, kept: 0, failed: 0 };

  const refs = await referencedUrls(exclude);
  const isReferenced = (u: string) => refs.urls.has(u) || refs.blobs.some((b) => b.includes(u));

  let deleted = 0;
  let kept = 0;
  let failed = 0;
  const list = [...candidates.values()];
  for (let i = 0; i < list.length; i += CONC) {
    await Promise.all(
      list.slice(i, i + CONC).map(async ({ key, url }) => {
        if (isReferenced(url)) {
          kept++;
          return;
        }
        const ok = await deleteR2Object(key, cfg);
        if (ok) deleted++;
        else failed++;
      })
    );
  }
  return { deleted, kept, failed };
}
