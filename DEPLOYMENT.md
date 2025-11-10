# Railway Deployment Instructions for RileyAI Website

## Prerequisites
- Railway account with CLI installed OR access to Railway dashboard
- Backend API already deployed on Railway
- Stripe account with production API keys
- Plaid account with production credentials

## Step 1: Prepare for Deployment

The following files have been created for you:
- ✅ `railway.toml` - Railway deployment configuration
- ✅ `.railwayignore` - Files to exclude from deployment
- ✅ `.env.production.example` - Example production environment variables
- ✅ `archive-old-site/` - Folder for old website backup

## Step 2: Deploy to Railway

### Option A: Using Railway CLI (Recommended)

```bash
# 1. Install Railway CLI (if not already installed)
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Navigate to project directory
cd C:/Users/RileyAI/Documents/rileyai-website

# 4. Initialize Railway project (or link existing)
railway init
# OR link to existing project:
railway link

# 5. Set environment variables (see Step 3 below for required variables)

# 6. Deploy to Railway
railway up
```

### Option B: Using Railway Dashboard

1. Go to https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo" or "Empty Project"
4. Connect your GitHub repository OR use Railway CLI to deploy
5. Railway will automatically detect Next.js and use the `railway.toml` configuration

## Step 3: Configure Environment Variables

Go to Railway Dashboard → Your Project → Variables tab and set the following:

### Required Variables:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app/api
NEXT_PUBLIC_WS_URL=wss://your-backend.up.railway.app

# Application URL
NEXT_PUBLIC_APP_URL=https://askrileyai.com

# Stripe Configuration (PRODUCTION KEYS!)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID=price_YOUR_BASIC_PLAN_ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PLAN_ID
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_YOUR_UNLIMITED_PLAN_ID

# Plaid Configuration (PRODUCTION!)
NEXT_PUBLIC_PLAID_CLIENT_ID=YOUR_PRODUCTION_PLAID_CLIENT_ID

# Chrome Extension
NEXT_PUBLIC_EXTENSION_ID=YOUR_CHROME_EXTENSION_ID
NEXT_PUBLIC_EXTENSION_URL=https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID

# Feature Flags
NEXT_PUBLIC_ENABLE_INVESTMENTS=true
NEXT_PUBLIC_ENABLE_TRADING_DESK=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

⚠️ **IMPORTANT**: Make sure to use PRODUCTION keys, not test keys!

## Step 4: Verify Deployment

After deployment completes:

1. **Check Railway Dashboard** - Ensure deployment status shows "Active"
2. **Test the Railway URL** - Visit your Railway-generated URL (e.g., https://your-app.up.railway.app)
3. **Test Core Functionality**:
   - Homepage loads correctly
   - Login/Register works
   - Dashboard displays data
   - API calls to backend succeed

## Step 5: Configure Custom Domain

### In Railway Dashboard:

1. Go to your project → Settings → Domains
2. Click "Add Domain"
3. Enter: `askrileyai.com`
4. Railway will provide DNS configuration instructions

### Update DNS (at your domain registrar):

Add these DNS records:

```
Type: A
Name: @
Value: [Railway IP address provided]

Type: CNAME
Name: www
Value: [Railway domain]
```

**OR** use Railway's nameservers (recommended):

```
ns1.railway.app
ns2.railway.app
```

### SSL Certificate:

Railway automatically provisions SSL certificates via Let's Encrypt. Wait 5-10 minutes after DNS propagation for SSL to activate.

## Step 6: Post-Deployment Verification

Test these critical paths:

- [ ] Homepage: https://askrileyai.com
- [ ] Login: https://askrileyai.com/login
- [ ] Dashboard: https://askrileyai.com/dashboard
- [ ] Pricing: https://askrileyai.com/pricing
- [ ] Stripe Checkout (test a purchase)
- [ ] Plaid Integration (connect account)
- [ ] API calls work correctly
- [ ] WebSocket connections establish

## Troubleshooting

### Build Errors:

```bash
# View build logs in Railway dashboard OR:
railway logs
```

### Environment Variables Not Working:

- Ensure all `NEXT_PUBLIC_*` variables are set (they must be prefixed with NEXT_PUBLIC_)
- Redeploy after changing environment variables:
  ```bash
  railway up --detach
  ```

### API Connection Issues:

- Verify `NEXT_PUBLIC_API_URL` points to correct backend URL
- Check backend is running and accessible
- Verify CORS settings on backend allow frontend domain

### SSL Certificate Issues:

- Wait 10-15 minutes after DNS changes
- Verify DNS records propagated: `nslookup askrileyai.com`
- Check Railway dashboard for SSL status

## Rolling Back

If you need to roll back to the old website:

1. The old website files should be backed up in a separate deployment or `archive-old-site/`
2. In Railway, you can roll back to previous deployment from the dashboard
3. OR redeploy the old site from backup

## Production Checklist

Before going live, ensure:

- [ ] All environment variables use PRODUCTION keys (not test)
- [ ] Backend API is deployed and healthy
- [ ] Database migrations are complete
- [ ] Stripe webhooks are configured
- [ ] DNS records are updated
- [ ] SSL certificate is active
- [ ] Test user registration/login flow
- [ ] Test payment flow end-to-end
- [ ] Monitor error logs for first 24 hours

## Support

- Railway Docs: https://docs.railway.app
- Next.js Deployment: https://nextjs.org/docs/deployment
- Railway Discord: https://discord.gg/railway

## Notes

- **Build Time**: Approximately 2-3 minutes
- **Auto-deploy**: Railway can auto-deploy on git push (configure in dashboard)
- **Scaling**: Railway automatically scales based on traffic
- **Logs**: Access via `railway logs` or dashboard
- **Cost**: Monitor usage in Railway dashboard

---

**Deployment prepared by Claude Code**
**Date**: 2025-11-10
