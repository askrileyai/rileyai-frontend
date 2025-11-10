import ProtectedRoute from '@/components/ProtectedRoute';
import FeatureGate from '@/components/FeatureGate';
import { Feature } from '@/utils/plans';
import TradingDesk from '@/components/pages/TradingDesk';

export default function Page() {
  return (
    <ProtectedRoute>
      <FeatureGate feature={Feature.CUSTOM_STRATEGIES}>
        <TradingDesk />
      </FeatureGate>
    </ProtectedRoute>
  );
}
