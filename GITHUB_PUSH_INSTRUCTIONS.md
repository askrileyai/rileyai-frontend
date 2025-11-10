# Push to GitHub Instructions

Your code is ready to push to GitHub! The repository has been initialized and committed locally.

## Option 1: Push to Existing GitHub Repository

If you already have a GitHub repository for this project:

```bash
cd C:/Users/RileyAI/Documents/rileyai-website

# Add your GitHub repository as remote (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/rileyai-website.git

# Push to GitHub
git push -u origin main
```

## Option 2: Create New GitHub Repository

### Using GitHub Website:

1. **Go to GitHub**: https://github.com/new
2. **Repository settings**:
   - Name: `rileyai-website`
   - Description: "RileyAI - AI-powered trading analysis website"
   - Visibility: Private (recommended) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. **Click "Create repository"**
4. **Push your code**:

```bash
cd C:/Users/RileyAI/Documents/rileyai-website

# Add the remote (GitHub will show you this command after creating the repo)
git remote add origin https://github.com/YOUR_USERNAME/rileyai-website.git

# Push to GitHub
git push -u origin main
```

### Using GitHub CLI (if you have it installed):

```bash
cd C:/Users/RileyAI/Documents/rileyai-website

# Create repo and push in one command
gh repo create rileyai-website --private --source=. --remote=origin --push
```

## After Pushing to GitHub

Once your code is on GitHub, you can deploy to Railway:

### Connect Railway to GitHub:

1. **Go to Railway Dashboard**: https://railway.app
2. **Click "New Project"**
3. **Choose "Deploy from GitHub repo"**
4. **Select your repository**: `rileyai-website`
5. **Railway will automatically**:
   - Detect Next.js project
   - Use the `railway.toml` configuration
   - Start building and deploying

### Set Environment Variables in Railway:

Go to your Railway project → Variables tab and add all variables from `.env.production.example`:

```bash
NEXT_PUBLIC_API_URL=https://rileyai-backend-production.up.railway.app/api
NEXT_PUBLIC_WS_URL=wss://rileyai-backend-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://askrileyai.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID=price_YOUR_ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_YOUR_ID
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_YOUR_ID
NEXT_PUBLIC_PLAID_CLIENT_ID=YOUR_ID
NEXT_PUBLIC_EXTENSION_ID=YOUR_ID
NEXT_PUBLIC_EXTENSION_URL=https://chrome.google.com/webstore/detail/YOUR_ID
NEXT_PUBLIC_ENABLE_INVESTMENTS=true
NEXT_PUBLIC_ENABLE_TRADING_DESK=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Configure Custom Domain:

1. In Railway → Settings → Domains
2. Add domain: `askrileyai.com`
3. Update DNS records as instructed by Railway

## What's Been Committed

✅ All 64 files have been committed:
- Complete Next.js application
- Design system components
- API hooks and integrations
- Authentication context
- Railway deployment config (`railway.toml`)
- Environment variable template (`.env.production.example`)
- Deployment documentation (`DEPLOYMENT.md`)
- TypeScript configuration
- Package dependencies

## Git Status

```
Current branch: main
Commit: 9a624ce
Message: Initial commit: Complete RileyAI website with Railway deployment config
Files: 64 files changed, 12,142 insertions(+)
```

## Next Steps After Push

1. ✅ Push code to GitHub (follow instructions above)
2. Connect Railway to GitHub repository
3. Configure environment variables in Railway
4. Deploy automatically
5. Configure custom domain
6. Test the deployment
7. Update DNS to point to Railway

## Need Help?

- **Git Issues**: Make sure you have git configured:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```

- **GitHub Authentication**: If prompted for credentials, use a Personal Access Token (PAT):
  1. Go to GitHub Settings → Developer settings → Personal access tokens
  2. Generate new token with `repo` scope
  3. Use token as password when prompted

- **Railway Issues**: See `DEPLOYMENT.md` for detailed troubleshooting

---

**Repository is ready to push!** 🚀
