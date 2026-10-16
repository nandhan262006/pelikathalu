import { notFound } from "next/navigation";
import AlbumDetail from "@/components/AlbumDetail";
import AlbumShell from "@/components/AlbumShell";
import { getAlbumBySlug, listPhotos } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function PortraitAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug, "portrait");
  if (!album) notFound();
  const photos = (await listPhotos(slug)).map((p) => p.url);
  const content = await getSiteContent("home", false);

  return (
    <AlbumShell paletteId={content?.theme?.paletteId} whatsapp={content?.links.whatsapp}>
      <AlbumDetail
        eyebrow="Portraits"
        title={album.title}
        description={album.description}
        count={photos.length}
        photos={photos}
        backHref="/portraits"
        backLabel="All Portraits"
      />
    </AlbumShell>
  );
}
