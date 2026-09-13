# Moneo Deployment Guide

Complete deployment instructions for Moneo with Cloudflare, Supabase, and Docker.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Cloudflare Setup](#cloudflare-setup)
4. [DNS Configuration](#dns-configuration)
5. [Deployment](#deployment)
6. [Post-Deployment Verification](#post-deployment-verification)

---

## Prerequisites

### Required Accounts

- [Cloudflare](https://dash.cloudflare.com/) account
- [Supabase](https://supabase.com/) account
- [Lemon Squeezy](https://lemonsqueezy.com/) account (for billing)
- Domain registrar (for moneo.bond)

### Required Tools

- Node.js 18+
- npm
- wrangler CLI: `npm install -g wrangler`
- Docker (optional, for local testing)

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com/)
2. Click "New Project"
3. Name: `moneo`
4. Database password: Generate and save securely
5. Region: Choose nearest to your users
6. Click "Create Project"

### 2. Get Credentials

1. Go to Project Settings → API
2. Copy `anon` public key
3. Copy project URL

### 3. Run Migrations

Navigate to SQL Editor in Supabase and run these migrations in order:

#### Migration 1: Core Schema
```sql
-- Create users table (if using custom auth)
-- Or use Supabase Auth (recommended)

-- Create profiles table
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create focus areas table
CREATE TABLE areas (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cloud_id UUID,
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Create sessions table
CREATE TABLE sessions (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  area_id TEXT,
  at BIGINT NOT NULL,
  min INTEGER NOT NULL,
  intention TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own areas" ON areas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own areas" ON areas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own areas" ON areas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own areas" ON areas
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);
```

#### Migration 2: User Scoped Area Identity
```sql
-- Add cloud_id column to areas if not exists
ALTER TABLE areas ADD COLUMN IF NOT EXISTS cloud_id UUID;

-- Update existing rows (set cloud_id = id for legacy data)
UPDATE areas SET cloud_id = id::UUID WHERE cloud_id IS NULL;
```

### 4. Update Environment Variables

Create `.env.local` in the Moneo project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LEMONSQUEZY_STORE_ID=your-store-id
VITE_LEMONSQUEZY_CHECKOUT_URL=https://your-store.lemonsqueezy.com/checkout
```

---

## Cloudflare Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Authenticate

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
cd cloudflare/workers
wrangler kv:namespace create KV_CACHE
```

Copy the ID and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-actual-kv-id"
preview_id = "your-preview-kv-id"
```

### 4. Create R2 Bucket

```bash
wrangler r2 bucket create moneo-assets
```

### 5. Configure Cloudflare Access (Optional)

For zero-trust authentication:

1. Go to Cloudflare Zero Trust → Access
2. Create new application: "Moneo"
3. Add authentication providers (Google, GitHub, etc.)
4. Create policy: Allow all users or specific emails
5. Get your Application URL

### 6. Deploy Worker

```bash
cd cloudflare/workers
npm install
wrangler deploy
```

---

## DNS Configuration

### Option 1: Cloudflare Workers (Recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click "Domains" → "Add Custom Domain"
3. Enter: `moneo.bond`
4. Verify ownership (add TXT record)
5. DNS will be configured automatically

### Option 2: Manual DNS

If using another hosting provider:

```
Type: CNAME
Name: @
Value: your-worker.workers.dev
TTL: 3600
```

Or for root domain (if supported):
```
Type: A
Name: @
Value: your-ip-address
TTL: 3600
```

---

## Deployment

### Option 1: Cloudflare Workers (Recommended)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Upload assets to R2:**
   ```bash
   wrangler r2 object put moneo-assets/index.html --file=dist/index.html
   wrangler r2 object put moneo-assets/manifest.webmanifest --file=dist/manifest.webmanifest
   wrangler r2 object put moneo-assets/sw.js --file=dist/sw.js
   wrangler r2 object put moneo-assets/workbox-*.js --file=dist/workbox-*.js
   wrangler r2 object put moneo-assets/assets/ --directory=dist/assets/
   ```

3. **Deploy worker:**
   ```bash
   cd cloudflare/workers
   wrangler deploy
   ```

### Option 2: Docker

1. **Build Docker image:**
   ```bash
   docker build -t moneo:latest .
   ```

2. **Run locally:**
   ```bash
   docker run -p 80:80 -e VITE_SUPABASE_URL=your_url -e VITE_SUPABASE_ANON_KEY=your_key moneo:latest
   ```

3. **Push to registry:**
   ```bash
   docker tag moneo:latest your-registry/moneo:latest
   docker push your-registry/moneo:latest
   ```

4. **Deploy to hosting provider** (Vercel, Railway, etc.)

### Option 3: Static Hosting (Vercel/Netlify)

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Deploy to Netlify:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

---

## Post-Deployment Verification

### 1. Test the Application

1. Open `https://moneo.bond` in browser
2. Verify:
   - Timer works
   - Can sign in with Supabase
   - Sync works (requires auth)
   - PWA is installable
   - Pricing page loads

### 2. Test PWA

1. Open DevTools → Application
2. Verify Service Worker is registered
3. Test offline mode (disconnect network)
4. Check manifest.json is valid

### 3. Test Billing

1. Sign in to account
2. Click "Upgrade to Pro"
3. Verify checkout opens in new tab
4. Complete purchase flow (test mode)

### 4. Test Account Deletion

1. Sign in to account
2. Click "Delete account"
3. Confirm deletion
4. Verify data is removed from Supabase
5. Verify local state is cleared

### 5. Test Cloudflare Features

If using Cloudflare Workers:

1. Check CDN caching is working (look for Cache-Control headers)
2. Test API proxying (if configured)
3. Verify KV cache is storing static assets
4. Check Access authentication (if configured)

---

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Supabase Connection Issues

- Verify `.env.local` has correct credentials
- Check Supabase project is active
- Verify RLS policies are correct
- Check CORS settings in Supabase

### Cloudflare Deployment Issues

```bash
# Check wrangler login status
wrangler whoami

# Check worker logs
wrangler tail

# Deploy with verbose output
wrangler deploy --verbose
```

### PWA Not Working

- Verify manifest.json is accessible
- Check service worker is registered
- Ensure HTTPS is enabled (required for PWA)
- Check browser console for errors

---

## Environment Variables Reference

### Production (.env.local)

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Lemon Squeezy
VITE_LEMONSQUEZY_STORE_ID=your-store-id
VITE_LEMONSQUEZY_CHECKOUT_URL=https://your-store.lemonsqueezy.com/checkout
```

### Cloudflare Workers (wrangler.toml)

```toml
# Update with your actual IDs
id = "your-actual-kv-id"
preview_id = "your-preview-kv-id"
```

---

## Security Checklist

- [ ] Supabase RLS policies enabled
- [ ] No API keys in client-side code
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Environment variables not committed
- [ ] Database backups enabled
- [ ] Rate limiting configured (Cloudflare)
- [ ] Account deletion flow working (GDPR)
- [ ] Privacy Policy and Terms of Service accessible

---

## Monitoring & Maintenance

### Recommended Tools

- **Error Tracking**: Sentry or LogRocket
- **Analytics**: Plausible or Google Analytics
- **Uptime Monitoring**: UptimeRobot or Better Uptime
- **Performance**: Lighthouse CI

### Regular Tasks

- Weekly: Check error logs
- Monthly: Review billing costs
- Quarterly: Update dependencies
- As needed: Update Supabase migrations

---

## Support

For issues with:
- **Supabase**: https://supabase.com/support
- **Cloudflare**: https://support.cloudflare.com
- **Lemon Squeezy**: https://lemonsqueezy.com/support
- **Moneo**: https://github.com/your-org/moneo/issues
