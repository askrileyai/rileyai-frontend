# RileyAI Website - Complete Redesign

**$10M Budget Aesthetic** - Production-ready dashboard and marketing site

## 🎯 Project Overview

This is the complete website overhaul for RileyAI, featuring:
- **Extension-first onboarding** (no signup on website)
- **Power-user dashboard** for deep analysis
- **World-class design system** (inspired by Stripe, Linear, Plaid)
- **Feature-gated content** by subscription tier
- **Bidirectional JWT sync** between extension ↔ website

## 📁 Project Structure

```
rileyai-website/
├── src/
│   ├── design-system/          # Core design system
│   │   ├── tokens.ts           # Colors, spacing, typography
│   │   ├── components/         # All UI components
│   │   └── index.ts            # Main export
│   │
│   ├── pages/                  # Main application pages
│   │   ├── DesignSystemDemo.tsx
│   │   ├── Homepage.tsx        # Coming soon
│   │   ├── Dashboard.tsx       # Coming soon
│   │   ├── Investments.tsx     # Coming soon
│   │   └── TradingDesk.tsx     # Coming soon
│   │
│   ├── components/             # Page-specific components
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript types
│
├── DESIGN_SYSTEM.md           # Design system documentation
├── HANDOFF.md                 # Complete project handoff
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

```bash
Node.js 18+ 
npm or yarn
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Recommended Dependencies

```bash
# Core
npm install react react-dom next

# Styling (if needed beyond inline styles)
npm install tailwindcss autoprefixer postcss

# Charts
npm install recharts chart.js react-chartjs-2

# Date handling
npm install date-fns

# API & State
npm install @tanstack/react-query zustand

# Forms (if needed)
npm install react-hook-form zod

# Plaid integration
npm install react-plaid-link
```

## 🎨 Design System

The project includes a comprehensive design system with:

- ✅ **Design Tokens** (colors, spacing, typography)
- ✅ **Core Components** (Button, Card, Badge, etc.)
- ✅ **Complex Components** (StatsCard, ProgressBar, UpgradePrompt)
- ✅ **Utility Components** (Toast, Modal, EmptyState, Skeleton)

**See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for full documentation**

### Quick Example

```tsx
import { Button, Card, StatsCard, ToastProvider } from '@/design-system';

function App() {
  return (
    <ToastProvider>
      <Card variant="elevated" padding={6}>
        <StatsCard
          label="Portfolio Value"
          value="$50,234"
          trend={{ direction: 'up', value: '+12.5%' }}
        />
        <Button variant="primary">View Details</Button>
      </Card>
    </ToastProvider>
  );
}
```

## 📋 Development Roadmap

### ✅ Phase 1: Design System (COMPLETE)
- [x] Design tokens
- [x] Core components
- [x] Complex components
- [x] Demo page
- [x] Documentation

### 🚧 Phase 2: Marketing Site (NEXT)
- [ ] Homepage redesign
- [ ] Features page
- [ ] Pricing page
- [ ] How it works page
- [ ] Mobile responsive

### 📅 Phase 3: Dashboard Core
- [ ] Authentication flow
- [ ] Main dashboard
- [ ] Account settings
- [ ] Usage analytics
- [ ] Navigation system

### 📅 Phase 4: Investments Module (BASIC+)
- [ ] Plaid integration UI
- [ ] Portfolio display
- [ ] Holdings table
- [ ] Charts (pie, line)
- [ ] AI recommendations

### 📅 Phase 5: Trading Desk (PRO+)
- [ ] Strategy viewer
- [ ] Signal feed
- [ ] Performance analytics
- [ ] Multi-timeframe confluence
- [ ] Backtest display

### 📅 Phase 6: Polish & Launch
- [ ] Chat history
- [ ] Session replays
- [ ] Micro-interactions
- [ ] Loading states
- [ ] Error handling
- [ ] Performance optimization

## 🎯 Key Features by Plan

### FREE ($0/month)
- 3 hours
- Core trading features
- Real-time AI analysis

### BASIC ($39/month)
- 30 hours
- Multi-timeframe analysis
- Chart snapshots
- **Investment tracking** ⭐

### PRO ($89/month)
- 100 hours
- Trading strategies
- Smart alerts
- **Trading Desk** ⭐

### UNLIMITED ($199/month)
- 999 hours
- API access
- Priority support

## 🔐 Authentication Flow

### Extension → Website
```typescript
// User clicks "View Dashboard" in extension
const token = localStorage.getItem('rileyai_jwt');
window.open(`https://askrileyai.com/dashboard?token=${token}`);
```

### Website → Extension
```typescript
// After login on website
const token = getSessionToken();
window.open(`https://www.tradingview.com?riley_token=${token}`);
```

## 📱 Responsive Design

- **Mobile (<768px)**: Bottom tab bar, stacked cards
- **Tablet (768px-1024px)**: 2-column layouts
- **Desktop (>1024px)**: Full sidebar, 3-4 column grids

## 🎨 Design Principles

1. **$10M Aesthetic**: World-class visual design
2. **Generous Whitespace**: Clean, uncluttered layouts
3. **Micro-interactions**: Smooth, delightful animations
4. **Data Viz Excellence**: Beautiful charts and graphs
5. **Premium Typography**: Inter/SF Pro fonts
6. **Glass Morphism**: Subtle, modern depth

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 14+
- **Language**: TypeScript
- **Styling**: Design System (inline styles) + Tailwind (optional)
- **State**: Zustand + React Query
- **Charts**: Recharts / Chart.js
- **Animations**: Framer Motion

### Backend (Existing)
- **API**: Node.js + Express (Railway)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Auth**: JWT tokens
- **Payments**: Stripe

### Deployment
- **Frontend**: Vercel (Next.js optimized)
- **Backend**: Railway (already setup)

## 📊 API Endpoints

All endpoints already exist on Railway backend:

```
# Auth
POST   /api/auth/validate-token
POST   /api/auth/refresh-token

# User
GET    /api/user/profile
GET    /api/user/usage-stats

# Investments (BASIC+)
GET    /api/investments/portfolio
POST   /api/investments/connect

# Trading Desk (PRO+)
GET    /api/strategies
GET    /api/strategies/:id/signals

# Analytics
GET    /api/analytics/usage
GET    /api/analytics/sessions
```

## 🚦 Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=https://api.askrileyai.com
NEXT_PUBLIC_WS_URL=wss://api.askrileyai.com

# Plaid
NEXT_PUBLIC_PLAID_ENV=sandbox
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret

# Analytics (optional)
NEXT_PUBLIC_GA_ID=your_ga_id
```

## 📝 Component Usage

### Feature Gating Example

```tsx
import { UpgradePrompt } from '@/design-system';
import { useAuth } from '@/hooks/useAuth';

export const InvestmentsPage = () => {
  const { user } = useAuth();
  
  // Gate for BASIC+ users
  if (user.plan === 'FREE') {
    return (
      <UpgradePrompt
        feature="Investment Tracking"
        requiredPlan="BASIC"
      />
    );
  }
  
  return <InvestmentsDashboard />;
};
```

### Toast Notifications

```tsx
import { useToast } from '@/design-system';

export const MyComponent = () => {
  const { showToast } = useToast();
  
  const handleSave = async () => {
    try {
      await saveData();
      showToast({
        variant: 'success',
        title: 'Saved!',
        description: 'Your changes have been saved.',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to save changes.',
      });
    }
  };
};
```

## 🎯 Next Steps

1. **Review Design System**: Check `/src/design-system/` and `DESIGN_SYSTEM.md`
2. **Run Demo Page**: See all components in action
3. **Build Homepage**: Start with marketing site redesign
4. **Dashboard Core**: Main authenticated hub
5. **Feature Pages**: Investments, Trading Desk, etc.

## 📚 Documentation

- **[HANDOFF.md](./HANDOFF.md)**: Complete project specification
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)**: Component documentation
- **[Feature Breakdown](./FEATURES.md)**: All plans and features

## 🤝 Contributing

This is a production project for RileyAI. For questions:
- Design system: See DESIGN_SYSTEM.md
- Project specs: See HANDOFF.md
- Feature details: See FEATURES.md

## 📞 Support

Questions or issues? Check the documentation first:
1. Design System Demo: `/design-system-demo`
2. Component docs: `DESIGN_SYSTEM.md`
3. Project handoff: `HANDOFF.md`

---

**Built with ❤️ for RileyAI**

*Last updated: November 2025*
