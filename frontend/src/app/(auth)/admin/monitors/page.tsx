import { Metadata } from 'next';
import { MonitorVisibilityManagement } from '@/components/admin/MonitorVisibilityManagement';

export const metadata: Metadata = {
  title: 'Monitor Visibility Management | MediaNest',
  description: 'Manage monitor visibility settings for users',
};

export default function MonitorsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MonitorVisibilityManagement />
    </div>
  );
}
