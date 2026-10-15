import { notFound } from "next/navigation";
import SiteRenderer from "@/components/SiteRenderer";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft } = await searchParams;
  const content = await getSiteContent("home", draft === "1");
  if (!content) notFound();
  return <SiteRenderer content={content} allowLive={draft === "1"} />;
}
