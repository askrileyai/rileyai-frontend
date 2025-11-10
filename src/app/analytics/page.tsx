import ProtectedRoute from '@/components/ProtectedRoute';
import Analytics from '@/components/pages/Analytics';

export default function Page() {
  return (
    <ProtectedRoute>
      <Analytics />
    </ProtectedRoute>
  );
}
