import type { Metadata } from "next";
import AlbumIndex from "@/components/AlbumIndex";
import AlbumShell from "@/components/AlbumShell";
import { listAlbumsSafe } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weddings — Real Stories from Hyderabad Couples",
  description: "Wedding galleries captured the way they feel — full-day stories, candid frames and films across Hyderabad and beyond.",
  alternates: { canonical: "/weddings" },
};

export default async function WeddingsPage() {
  const [albums, content] = await Promise.all([
    listAlbumsSafe({ category: "wedding", hideEmpty: true }),
    getSiteContent("home", false),
  ]);
  return (
    <AlbumShell paletteId={content?.theme?.paletteId} fontId={content?.theme?.fontId} whatsapp={content?.links.whatsapp}>
      <AlbumIndex
        eyebrow="Weddings"
        title="Weddings"
        sub={
          albums.length
            ? `${albums.length} ${albums.length === 1 ? "story" : "stories"} — tap a couple to open their full gallery.`
            : "Wedding stories are on their way."
        }
        base="weddings"
        albums={albums}
        emptyHint="No wedding galleries yet — fresh stories dropping soon."
      />
    </AlbumShell>
  );
}
