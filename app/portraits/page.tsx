import AlbumIndex from "@/components/AlbumIndex";
import AlbumShell from "@/components/AlbumShell";
import { listAlbums } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function PortraitsPage() {
  const [albums, content] = await Promise.all([
    listAlbums({ category: "portrait", hideEmpty: true }),
    getSiteContent("home", false),
  ]);
  return (
    <AlbumShell paletteId={content?.theme?.paletteId} whatsapp={content?.links.whatsapp}>
      <AlbumIndex
        eyebrow="Beyond weddings"
        title="Portraits"
        sub={
          albums.length
            ? `${albums.length} ${albums.length === 1 ? "gallery" : "galleries"} — tap a cover to open the full gallery.`
            : "Portrait galleries are on their way."
        }
        base="portraits"
        albums={albums}
        emptyHint="No portrait galleries yet — fresh faces dropping soon."
      />
    </AlbumShell>
  );
}
