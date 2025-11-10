# Netlify Environment Variables

Configure these in Netlify Dashboard → Site Settings → Environment Variables

## Required Variables

```bash
# Backend API (Railway)
NEXT_PUBLIC_API_URL=https://rileyai-backend-production.up.railway.app/api
NEXT_PUBLIC_WS_URL=wss://rileyai-backend-production.up.railway.app

# Application URL
NEXT_PUBLIC_APP_URL=https://askrileyai.com

# Plaid Configuration (Production)
NEXT_PUBLIC_PLAID_CLIENT_ID=690e563c80195100206dcfbc

# Feature Flags
NEXT_PUBLIC_ENABLE_INVESTMENTS=true
NEXT_PUBLIC_ENABLE_TRADING_DESK=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## Stripe Variables (Update with Production Keys)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID=price_YOUR_BASIC_PLAN_ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PLAN_ID
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_YOUR_UNLIMITED_PLAN_ID
```

## Chrome Extension (Optional)

```bash
NEXT_PUBLIC_EXTENSION_ID=YOUR_CHROME_EXTENSION_ID
NEXT_PUBLIC_EXTENSION_URL=https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID
```

## How to Set in Netlify

1. Go to https://app.netlify.com
2. Select your site (rileyai-frontend or askrileyai.com)
3. Go to Site Settings → Environment Variables
4. Add each variable using the "Add a variable" button
5. After adding all variables, trigger a new deploy

## After Deployment

- Verify the site at https://askrileyai.com
- Test login/authentication
- Test API calls to Railway backend
- Update Stripe keys to production values when ready
