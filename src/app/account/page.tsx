import ProtectedRoute from '@/components/ProtectedRoute';
import Account from '@/components/pages/Account';

export default function Page() {
  return (
    <ProtectedRoute>
      <Account />
    </ProtectedRoute>
  );
}
