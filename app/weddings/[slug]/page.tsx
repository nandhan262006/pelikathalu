import { notFound } from "next/navigation";
import AlbumDetail from "@/components/AlbumDetail";
import AlbumShell from "@/components/AlbumShell";
import { getAlbumBySlug, listPhotosSafe } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function WeddingAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug, "wedding");
  if (!album) notFound();
  const photos = (await listPhotosSafe(slug)).map((p) => p.url);
  const content = await getSiteContent("home", false);

  return (
    <AlbumShell paletteId={content?.theme?.paletteId} whatsapp={content?.links.whatsapp}>
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
