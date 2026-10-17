import type { MetadataRoute } from "next";
import { listAlbumsSafe } from "@/lib/albums";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic"; // regenerated per request; albums change from the admin

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${SITE_URL}/weddings`, changeFrequency: "weekly", priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/portraits`, changeFrequency: "weekly", priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/portfolio`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
  ];
  const albums = await listAlbumsSafe({ hideEmpty: true });
  const albumEntries: MetadataRoute.Sitemap = albums.map((a) => ({
    url: `${SITE_URL}/${a.category === "portrait" ? "portraits" : "weddings"}/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [...statics, ...albumEntries];
}
