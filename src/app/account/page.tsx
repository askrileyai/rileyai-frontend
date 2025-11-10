import ProtectedRoute from '@/components/ProtectedRoute';
import Account from '@/pages/Account';

export default function Page() {
  return (
    <ProtectedRoute>
      <Account />
    </ProtectedRoute>
  );
}
