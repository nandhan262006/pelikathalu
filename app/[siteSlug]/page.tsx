import { notFound } from "next/navigation";
import SiteRenderer from "@/components/SiteRenderer";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { siteSlug } = await params;
  const { draft } = await searchParams;
  const content = await getSiteContent(siteSlug, draft === "1");
  if (!content) notFound();
  return <SiteRenderer content={content} allowLive={draft === "1"} />;
}
