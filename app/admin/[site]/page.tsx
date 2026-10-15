import Dashboard from "@/components/dashboard/Dashboard";

export default async function DashboardPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <Dashboard site={site} />;
}
