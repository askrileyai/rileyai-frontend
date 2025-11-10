# RileyAI Design System

**$10M Budget Aesthetic** - Inspired by Stripe, Linear, and Plaid

A comprehensive, production-ready React design system for the RileyAI website and dashboard.

---

## 📦 Installation

```typescript
// Import everything from a single entry point
import { Button, Card, colors, spacing } from '@/design-system';
```

---

## 🎨 Design Tokens

### Colors

```typescript
import { colors } from '@/design-system';

// Primary gradient
colors.primary.start   // #667eea
colors.primary.end     // #764ba2
colors.primary.solid   // #6b7de8 (mid-point)

// Semantic colors
colors.success         // #10b981
colors.warning         // #f59e0b
colors.error           // #ef4444
colors.info            // #3b82f6

// Neutral scale (50-900)
colors.neutral[900]    // Darkest text
colors.neutral[600]    // Body text
colors.neutral[200]    // Borders
colors.neutral[50]     // Background
```

### Spacing

```typescript
import { spacing } from '@/design-system';

spacing[1]  // 4px
spacing[2]  // 8px
spacing[3]  // 12px
spacing[4]  // 16px
spacing[6]  // 24px
spacing[8]  // 32px
spacing[12] // 48px
```

### Typography

```typescript
import { typography } from '@/design-system';

typography.fontSize.tiny      // 11px
typography.fontSize.small     // 13px
typography.fontSize.body      // 15px
typography.fontSize.h3        // 20px
typography.fontSize.h2        // 28px
typography.fontSize.h1        // 36px
typography.fontSize.display   // 48px
```

---

## 🧩 Core Components

### Button

Multiple variants, sizes, and states.

```tsx
<Button variant="primary" size="md">
  Click Me
</Button>

<Button 
  variant="primary" 
  loading
  leftIcon={<PlusIcon />}
>
  Loading...
</Button>

// Variants: primary, secondary, ghost, danger
// Sizes: sm, md, lg
```

### Card

Container component with multiple visual styles.

```tsx
<Card variant="default" padding={6}>
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>

// Variants: default, elevated, bordered, glass
// hoverable prop for interactive cards
```

### StatsCard

Display key metrics with optional trend indicators and icons.

```tsx
<StatsCard
  label="Portfolio Value"
  value="$50,234"
  trend={{ direction: 'up', value: '+12.5%' }}
  icon={<ChartIcon />}
  variant="primary"
/>

// Trend directions: up, down, neutral
// Variants: default, primary, success, warning, danger
```

### ProgressBar

Linear and circular progress indicators with auto-coloring.

```tsx
// Linear progress
<ProgressBar
  variant="linear"
  value={45.2}
  max={100}
  showLabel
  label="Hours Used"
/>

// Circular progress
<ProgressBar
  variant="circular"
  value={45.2}
  max={100}
  label="Hours Remaining"
  size={120}
/>

// Auto-colors based on percentage:
// 0-20%: danger (red)
// 21-50%: warning (amber)
// 51-100%: primary (blue)
```

### Badge & MetricBadge

Compact status indicators and metric displays.

```tsx
<Badge variant="success">Active</Badge>

<MetricBadge
  label="Win Rate"
  value="68%"
  trend="up"
  variant="success"
/>

// Variants: default, primary, success, warning, danger, neutral
// Sizes: sm, md, lg
```

### UpgradePrompt

Feature-locked content with upgrade CTA.

```tsx
<UpgradePrompt
  feature="Trading Strategies"
  requiredPlan="PRO"
  benefits={[
    'Real-time strategy signals',
    'Custom strategy builder',
    'Backtest on historical data'
  ]}
  onUpgrade={() => navigate('/account?upgrade=true')}
/>

// Plan tiers: BASIC, PRO, UNLIMITED
```

### EmptyState

Display when no data is available.

```tsx
<EmptyState
  icon={<InboxIcon />}
  title="No sessions yet"
  description="Start a trading session to see your analytics here."
  action={{
    label: 'Start Session',
    onClick: handleStartSession
  }}
/>
```

### Toast Notifications

App-wide notification system.

```tsx
// Wrap your app
<ToastProvider>
  <App />
</ToastProvider>

// Use anywhere
const { showToast } = useToast();

showToast({
  variant: 'success',
  title: 'Saved!',
  description: 'Your changes have been saved.',
  duration: 5000 // optional, defaults to 5000ms
});

// Variants: success, error, warning, info
```

### Modal

Dialog component with header, content, and footer.

```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Welcome"
  description="This is a modal dialog"
  size="md"
  footer={
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onConfirm}>Confirm</Button>
    </>
  }
>
  <p>Modal content goes here</p>
</Modal>

// Sizes: sm (400px), md (600px), lg (800px), xl (1000px)
```

### ConfirmModal

Pre-built confirmation dialog.

```tsx
<ConfirmModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleDelete}
  title="Delete Account"
  description="This action cannot be undone."
  confirmText="Delete"
  variant="danger"
/>
```

### Loading Skeletons

Smooth loading state indicators.

```tsx
// Basic skeleton
<Skeleton width="100%" height="40px" />

// Text lines
<TextSkeleton lines={3} />

// Pre-built patterns
<CardSkeleton />
<TableSkeleton rows={5} columns={4} />
<DashboardSkeleton />
```

---

## 🎯 Usage Examples

### Dashboard Card with Stats

```tsx
<Card variant="elevated" padding={6}>
  <StatsCard
    label="Total Value"
    value="$50,234"
    trend={{ direction: 'up', value: '+12.5%' }}
    icon={<ChartUpIcon />}
  />
</Card>
```

### Feature Gate

```tsx
const InvestmentsPage = () => {
  const { user } = useAuth();
  
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

### Usage Progress Display

```tsx
<Card variant="bordered" padding={6}>
  <ProgressBar
    variant="circular"
    value={hoursUsed}
    max={planLimits[user.plan]}
    label="Hours Remaining"
  />
  <div style={{ marginTop: spacing[4] }}>
    <Badge variant={hoursUsed > 80 ? 'danger' : 'success'}>
      {hoursRemaining} hours left
    </Badge>
  </div>
</Card>
```

---

## 🎨 Design Principles

### 1. Consistency
- Use design tokens for all spacing, colors, and typography
- Follow the spacing scale: 4px increments (4, 8, 12, 16, 24, 32...)
- Maintain visual hierarchy with font sizes

### 2. Accessibility
- All interactive elements have :hover and :focus states
- Color contrast meets WCAG AA standards
- Loading and disabled states are clearly indicated

### 3. Responsive Design
- Mobile-first approach
- Components adapt to container size
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

### 4. Performance
- CSS-in-JS with inline styles (no build step needed)
- Smooth animations (200ms standard transition)
- Optimized SVG icons

### 5. Micro-interactions
- Subtle hover effects
- Smooth state transitions
- Loading states with spinners/skeletons
- Toast notifications for feedback

---

## 📱 Responsive Guidelines

### Mobile (<768px)
- Stack cards vertically
- Full-width buttons
- Simplified navigation
- Reduced padding

### Tablet (768px-1024px)
- 2-column layouts
- Medium spacing
- Side-by-side actions

### Desktop (>1024px)
- 3-4 column grids
- Generous whitespace
- Sidebar navigation
- Hover interactions

---

## 🚦 Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Button | ✅ Complete | All variants tested |
| Card | ✅ Complete | Including glass variant |
| StatsCard | ✅ Complete | With trend indicators |
| ProgressBar | ✅ Complete | Linear & circular |
| Badge | ✅ Complete | Multiple sizes |
| UpgradePrompt | ✅ Complete | Plan-aware |
| EmptyState | ✅ Complete | Flexible actions |
| Toast | ✅ Complete | With provider |
| Modal | ✅ Complete | Multiple sizes |
| Skeleton | ✅ Complete | Pre-built patterns |

---

## 🎨 Figma / Design Reference

Color Palette:
- Primary: #667eea → #764ba2 (gradient)
- Success: #10b981
- Warning: #f59e0b
- Error: #ef4444

Typography:
- Font: Inter (fallback to SF Pro, system fonts)
- Scale: 11, 13, 15, 20, 28, 36, 48px

Spacing:
- Base unit: 4px
- Common values: 4, 8, 12, 16, 24, 32, 48, 64px

---

## 📝 Best Practices

### Do ✅
- Use design tokens for colors and spacing
- Wrap app in ToastProvider for notifications
- Use UpgradePrompt for gated features
- Show loading skeletons while fetching data
- Provide empty states for no-data scenarios

### Don't ❌
- Hard-code colors or spacing values
- Use CSS classes (components use inline styles)
- Skip loading states
- Forget error handling
- Ignore mobile responsiveness

---

## 🔧 TypeScript Support

All components are fully typed with TypeScript:

```typescript
import type { ButtonProps, CardVariant, PlanTier } from '@/design-system';

const MyButton: React.FC<ButtonProps> = (props) => {
  return <Button {...props} />;
};
```

---

## 📦 File Structure

```
src/design-system/
├── tokens.ts                 # Design tokens (colors, spacing, etc.)
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── StatsCard.tsx
│   ├── ProgressBar.tsx
│   ├── Badge.tsx
│   ├── UpgradePrompt.tsx
│   ├── EmptyState.tsx
│   ├── Toast.tsx
│   ├── Modal.tsx
│   └── LoadingSkeleton.tsx
└── index.ts                  # Main export file
```

---

## 🚀 Getting Started

1. **Import the design system:**
   ```tsx
   import { Button, Card, ToastProvider } from '@/design-system';
   ```

2. **Wrap your app with ToastProvider:**
   ```tsx
   <ToastProvider>
     <App />
   </ToastProvider>
   ```

3. **Start building:**
   ```tsx
   <Card variant="elevated">
     <StatsCard
       label="Portfolio Value"
       value="$50,234"
       trend={{ direction: 'up', value: '+12.5%' }}
     />
   </Card>
   ```

4. **View the demo:**
   - See `src/pages/DesignSystemDemo.tsx` for live examples
   - All components showcased with various configurations

---

## 💡 Tips

- **Consistent Spacing**: Use the spacing scale (4, 8, 12, 16, 24, 32...)
- **Color Usage**: Use semantic colors (success, warning, error) for user feedback
- **Loading States**: Always show skeletons while loading
- **Empty States**: Provide helpful empty states with actions
- **Mobile First**: Design for mobile, enhance for desktop
- **Performance**: Components are optimized with minimal re-renders

---

## 📞 Support

Questions about the design system? Check:
- Demo page: `/design-system-demo`
- Component source code in `src/design-system/components/`
- TypeScript types for prop documentation

---

**Built with ❤️ for RileyAI**
