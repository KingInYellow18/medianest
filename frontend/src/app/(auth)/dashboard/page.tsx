import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { getServiceStatus } from '@/lib/api/services';

export default async function DashboardPage() {
  const services = await getServiceStatus();

  return (
    <DashboardLayout initialServices={services}>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
    </DashboardLayout>
  );
}
