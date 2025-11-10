import ProtectedRoute from '@/components/ProtectedRoute';
import FeatureGate from '@/components/FeatureGate';
import { Feature } from '@/utils/plans';
import Investments from '@/components/pages/Investments';

export default function Page() {
  return (
    <ProtectedRoute>
      <FeatureGate feature={Feature.PORTFOLIO_TRACKING}>
        <Investments />
      </FeatureGate>
    </ProtectedRoute>
  );
}
