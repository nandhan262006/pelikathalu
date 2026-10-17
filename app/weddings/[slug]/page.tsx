import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AlbumDetail from "@/components/AlbumDetail";
import AlbumShell from "@/components/AlbumShell";
import { getAlbumBySlug, listPhotosSafe } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";
import { absoluteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug, "wedding").catch(() => null);
  if (!album) return { title: "Wedding story not found" };
  const desc = album.description ?? `Wedding gallery by Pelli Kathalu — ${album.couple ?? album.title}, captured the way they feel.`;
  return {
    title: `${album.title} — Wedding Story`,
    description: desc,
    alternates: { canonical: `/weddings/${slug}` },
    openGraph: {
      title: `${album.title} — Wedding Story | Pelli Kathalu`,
      description: desc,
      type: "article",
      ...(album.cover ? { images: [{ url: album.cover, alt: `${album.title} — wedding cover` }] } : {}),
    },
  };
}

export default async function WeddingAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug, "wedding");
  if (!album) notFound();
  const photos = (await listPhotosSafe(slug)).map((p) => p.url);
  const content = await getSiteContent("home", false);

  return (
    <AlbumShell paletteId={content?.theme?.paletteId} fontId={content?.theme?.fontId} whatsapp={content?.links.whatsapp}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ImageGallery",
            name: album.title,
            description: album.description ?? undefined,
            url: absoluteUrl(`/weddings/${slug}`),
            image: photos.slice(0, 24),
            associatedMedia: photos.slice(0, 6).map((u) => ({ "@type": "ImageObject", contentUrl: u })),
          }),
        }}
      />
      <AlbumDetail
        eyebrow="Weddings"
        title={album.title}
        description={album.description}
        count={photos.length}
        photos={photos}
        backHref="/weddings"
        backLabel="All Weddings"
      />
    </AlbumShell>
  );
}
