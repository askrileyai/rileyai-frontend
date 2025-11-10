import ProtectedRoute from '@/components/ProtectedRoute';
import Dashboard from '@/components/pages/Dashboard';

export default function Page() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
