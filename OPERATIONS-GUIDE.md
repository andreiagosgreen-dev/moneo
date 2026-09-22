# Moneo - Operations & Technical Guide

## 🏗️ Technical Architecture Overview

### **Current Stack**

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deployment:** Cloudflare Pages (static hosting)
- **Edge:** Cloudflare Workers (optional)
- **Billing:** Lemon Squeezy (not yet connected)
- **Email:** Resend/SendGrid (UI ready, not connected)

---

## 💳 Lemon Squeezy Integration

### **Current Status**

- ✅ Lemon Squeezy SDK installed (@lemonsqueezy/lemonsqueezy.js)
- ✅ Pricing UI implemented (PricingCard component)
- ✅ Billing types defined (lib/billing/lemonSqueezy.ts)
- ❌ Store not created
- ❌ Products not created
- ❌ Webhook not implemented
- ❌ Real checkout URLs not configured

### **Setup Steps (Before Launch)**

#### 1. Create Lemon Squeezy Store

1. Go to [lemonsqueezy.com](https://lemonsqueezy.com)
2. Sign up / Log in
3. Create a new store: "Moneo Productivity"
4. Configure store settings (currency, tax, etc.)

#### 2. Create Products & Variants

```
Product: Moneo Pro
  Variant: Monthly ($5.99/month)
  Variant: Annual ($59.99/year - $5.00/month)

Product: Moneo Teams (Future)
  Variant: Monthly ($29/month)
```

#### 3. Configure Checkout URLs

Copy variant IDs and update in:

- `src/lib/billing/lemonSqueezy.ts`
- Environment variables (if needed)

#### 4. Implement Webhook Handler

Create endpoint to receive Lemon Squeezy webhooks:

```typescript
// cloudflare/workers/webhook.ts (or Supabase Edge Function)
export async function handleWebhook(request: Request) {
  const signature = request.headers.get('X-Signature');
  const body = await request.json();

  // Verify signature
  const isValid = verifyWebhookSignature(body, signature);
  if (!isValid) return new Response('Invalid signature', { status: 401 });

  // Handle events
  switch (body.meta.event_name) {
    case 'subscription_created':
      await activateSubscription(body.data);
      break;
    case 'subscription_updated':
      await updateSubscription(body.data);
      break;
    case 'subscription_cancelled':
      await cancelSubscription(body.data);
      break;
  }

  return new Response('OK');
}
```

#### 5. Database Schema for Subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lemon_squeezy_id TEXT UNIQUE NOT NULL,
  variant_id TEXT NOT NULL,
  status TEXT NOT NULL, -- active, cancelled, expired
  renews_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

#### 6. Frontend Integration

Update `PricingCard.tsx` to:

- Redirect to real Lemon Squeezy checkout URLs
- Store customer ID in Supabase
- Show subscription status in AccountButton

### **Security Considerations**

- Never expose Lemon Squeezy API key in frontend
- Use Supabase Edge Functions or Cloudflare Workers for API calls
- Verify webhook signatures
- Store sensitive data only in Supabase

---

## 🔐 Authentication System

### **Current Status**

- ✅ Supabase Auth implemented
- ✅ Email/password sign up
- ✅ Sign in
- ✅ Sign out
- ✅ Account deletion (database data only)
- ❌ Google OAuth (not implemented)
- ❌ Social auth (not implemented)

### **Authentication Flow**

#### Current Flow

1. User signs up with email/password
2. Supabase creates auth user
3. User profile created in `profiles` table
4. User logged in automatically
5. Session managed by Supabase client

#### Future Flow (Google OAuth)

1. User clicks "Sign in with Google"
2. Redirect to Google OAuth
3. User authorizes
4. Google redirects back with code
5. Supabase exchanges code for user
6. User profile created if new
7. User logged in

### **Implementing Google OAuth**

#### Step 1: Enable Google Auth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add Google OAuth credentials (client ID, secret)
4. Configure redirect URL: `https://moneo.bond/auth/callback`

#### Step 2: Add Google Sign In Button

```typescript
// src/components/GoogleSignIn.tsx
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) console.error(error);
};
```

#### Step 3: Handle Callback

```typescript
// src/pages/AuthCallback.tsx
useEffect(() => {
  const handleCallback = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Handle error
    } else {
      // Redirect to app
      window.location.href = '/';
    }
  };
  handleCallback();
}, []);
```

### **Security Best Practices**

- Never store passwords in frontend
- Use Supabase Row Level Security (RLS)
- Secure API endpoints with auth checks
- Log out users after inactivity
- Implement rate limiting

---

## 🎨 UI/UX Modifications

### **Current UI**

- Dark theme default
- Clean, minimal design
- Basic timer interface
- Focus Areas categorization
- Statistics dashboard

### **Pre-Launch UI Improvements**

#### 1. Onboarding Flow

- Welcome screen
- Quick tutorial (3 slides)
- Feature highlights
- First session guidance

#### 2. Premium Polish

- Smooth animations (300ms transitions)
- Loading states
- Error states
- Success states (confetti)
- Hover effects
- Dark/light theme toggle

#### 3. Mobile Optimization

- Touch-friendly timer controls
- Bottom navigation
- Swipe gestures
- Responsive layout (320px+)

#### 4. Accessibility

- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast ratios
- Focus indicators

### **UI Framework**

- Current: Tailwind CSS 4
- Recommended: Keep Tailwind, add:
  - Framer Motion (animations)
  - Headless UI (components)
  - Radix UI (primitives)

---

## 🔧 Maintenance Strategy

### **Regular Maintenance Tasks**

#### Daily

- Monitor error logs (Sentry)
- Check uptime (Uptime Robot)
- Review user feedback
- Monitor revenue metrics

#### Weekly

- Review analytics (user engagement)
- Check performance metrics
- Review security alerts
- Update dependencies (if critical)

#### Monthly

- Database backups verification
- Security audit
- Performance optimization
- Feature usage analysis
- Competitor analysis

#### Quarterly

- Major dependency updates
- Security review
- User survey
- Roadmap planning
- Technology stack evaluation

### **Maintenance Tools**

#### Error Monitoring

- **Sentry** (Recommended)
  - Real-time error tracking
  - Stack traces
  - User context
  - Release tracking
  - $26/month for up to 50k errors/month

#### Uptime Monitoring

- **Uptime Robot** (Free)
  - Checks every 5 minutes
  - Email/SMS alerts
  - Status page included

#### Analytics

- **Plausible** (Self-hosted, $9/month)
  - Privacy-focused
  - Simple dashboard
  - Goal tracking

- **Google Analytics** (Free)
  - Comprehensive
  - Advanced features
  - Privacy concerns

### **Maintenance Workflow**

#### Bug Fix Process

1. User reports bug → Jira/GitHub issue
2. Team triages → Priority assigned
3. Developer fixes → Pull request
4. Code review → Approve
5. Tests pass → Merge
6. Deploy to staging → Verify
7. Deploy to production → Monitor

#### Feature Update Process

1. Plan feature → Design specs
2. Implement → Tests
3. Code review → Approve
4. Deploy to staging → QA
5. Deploy to production → Monitor
6. Collect feedback → Iterate

---

## 🐛 Debugging Strategy

### **Development Debugging**

#### Local Development

```bash
# Run dev server
npm run dev

# Run tests
npm run test:run

# Typecheck
npm run typecheck

# Build
npm run build
```

#### Debugging Tools

- **React DevTools** (Browser extension)
- **Supabase Dashboard** (Database queries)
- **Cloudflare Dashboard** (Worker logs)
- **Chrome DevTools** (Network, Console, Performance)

### **Production Debugging**

#### Error Tracking

- Sentry captures errors automatically
- Stack traces with source maps
- User session replay
- Performance monitoring

#### Log Analysis

- Cloudflare Workers logs
- Supabase logs
- Application logs (if needed)

#### Common Issues & Solutions

**Issue: Auth session expired**

- Solution: Implement automatic token refresh
- Check Supabase auth configuration

**Issue: Database connection failed**

- Solution: Check Supabase status page
- Verify RLS policies
- Check database size limits

**Issue: Slow page load**

- Solution: Optimize bundle size
- Lazy load components
- Implement caching

**Issue: Payment failed**

- Solution: Check Lemon Squeezy webhook
- Verify subscription status
- Contact Lemon Squeezy support

---

## 🗄️ Database Architecture

### **Primary Database: Supabase (PostgreSQL)**

#### Location

- **Region:** Choose region closest to users (EU/US)
- **Hosting:** Supabase (managed PostgreSQL)
- **Backup:** Automatic daily backups + point-in-time recovery

#### Current Tables

```sql
-- Users (Supabase Auth)
auth.users (managed by Supabase)

-- Profiles
profiles (user metadata, timezone)

-- Focus Areas
focus_areas (categories for sessions)

-- Sessions
focus_sessions (completed focus sessions)

-- Subscriptions (to be added)
subscriptions (billing status)
```

#### Future Tables (Pre-Launch)

```sql
-- Projects
projects (project management)

-- Tasks
tasks (task lists in projects)

-- Goals
goals (vision/milestone/project goals)

-- Habits
habits (habit tracking)

-- Time Blocks
time_blocks (calendar integration)
```

### **Database Design Principles**

#### Normalization

- Each table has single responsibility
- Avoid data duplication
- Use foreign keys for relationships

#### Indexing

- Index frequently queried columns
- Composite indexes for common joins
- Regular index maintenance

#### Row Level Security (RLS)

- Users can only access their own data
- Teams can access team data
- Admin can access all data

### **Backup Strategy**

#### Supabase Backups

- **Automatic:** Daily backups retained for 7 days
- **Point-in-time Recovery:** Restore to any point in 7 days
- **Physical Backups:** Optional paid feature

#### Additional Backups

- **Export to CSV:** Weekly export of critical tables
- **External Backup:** Optional PostgreSQL backup service

### **Database Scaling**

#### When to Scale

- Storage: > 1GB (Supabase free tier is 500MB)
- Connections: > 50 concurrent
- Query time: > 100ms average

#### Scaling Options

- **Supabase Pro:** $25/month (10GB storage, 500 concurrent connections)
- **Supabase Enterprise:** Custom pricing
- **Self-hosted PostgreSQL:** Full control, more maintenance

---

## 🚀 Deployment Architecture

### **Current Deployment**

#### Frontend (Cloudflare Pages)

- **Location:** Global CDN (300+ locations)
- **Build:** Static HTML/CSS/JS
- **Hosting:** Free tier (unlimited bandwidth)
- **SSL:** Automatic (Let's Encrypt)
- **Custom Domain:** moneo.bond

#### Backend (Supabase)

- **Location:** EU or US region
- **Hosting:** Managed PostgreSQL
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (if needed)

#### Edge (Cloudflare Workers) - Optional

- **Location:** Global edge
- **Purpose:** API proxying, caching
- **Cost:** Free tier ($5/month if exceeded)

### **Deployment Pipeline**

#### Manual Deployment (Current)

```bash
# Build
npm run build

# Upload to Cloudflare Pages (automatic from Git)
git push origin main
```

#### Automated Deployment (Future)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build
        run: npm ci && npm run build
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
```

### **Environment Variables**

#### Supabase (Frontend)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

#### Lemon Squeezy (Backend/Worker)

```env
LEMONSQUEEZY_API_KEY=xxx
LEMONSQUEEZY_STORE_ID=xxx
LEMONSQUEEZY_WEBHOOK_SECRET=xxx
```

#### Sentry (Frontend)

```env
VITE_SENTRY_DSN=xxx
```

---

## 🔒 Security Strategy

### **Security Layers**

#### 1. Application Security

- Input validation (all user inputs)
- XSS prevention (React default)
- CSRF protection (Supabase)
- Content Security Policy (CSP headers)

#### 2. Data Security

- Encryption at rest (Supabase)
- Encryption in transit (HTTPS)
- RLS policies (data isolation)
- No secrets in frontend

#### 3. API Security

- Rate limiting (Cloudflare)
- API key validation
- Webhook signature verification
- Admin-only endpoints

#### 4. Auth Security

- Strong password requirements
- Session management (Supabase)
- Multi-factor authentication (future)
- OAuth with PKCE (Google auth)

### **Security Checklist**

#### Pre-Launch

- [ ] RLS policies configured
- [ ] No secrets in frontend code
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] Error messages don't leak info
- [ ] Dependencies audited (npm audit)

#### Post-Launch

- [ ] Regular security updates
- [ ] Penetration testing (quarterly)
- [ ] Dependency updates (monthly)
- [ ] Access review (quarterly)

---

## 📊 Monitoring & Analytics

### **Key Metrics to Monitor**

#### User Metrics

- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Session duration
- Feature usage

#### Business Metrics

- Free → Pro conversion rate
- Churn rate
- Revenue MRR
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)

#### Technical Metrics

- Page load time
- Error rate
- Uptime percentage
- API response time

### **Monitoring Tools**

#### User Analytics

- **Plausible** (Self-hosted, $9/month)
  - Privacy-focused
  - Simple dashboard
  - No cookies required

- **Google Analytics** (Free)
  - Comprehensive
  - Advanced features
  - Privacy concerns

#### Error Monitoring

- **Sentry** ($26/month)
  - Real-time errors
  - Stack traces
  - User context

#### Uptime Monitoring

- **Uptime Robot** (Free)
  - Checks every 5 minutes
  - Email/SMS alerts
  - Status page

---

## 🆘 Support Strategy

### **Support Channels**

#### Self-Service

- **Documentation:** README.md, DEPLOYMENT.md
- **FAQ:** Common questions
- **Tutorials:** How-to guides
- **Videos:** Feature walkthroughs

#### Direct Support

- **Email:** support@moneo.bond
- **Chat:** Intercom (future, $49/month)
- **Ticket System:** Zendesk (future)

### **Support Tiers**

#### Free Tier

- Email support (48h response)
- Documentation only
- Community forum

#### Pro Tier

- Email support (24h response)
- Priority ticket handling
- Feature requests considered

#### Teams Tier

- Dedicated support (4h response)
- Slack integration
- Custom onboarding

---

## 📅 Pre-Launch Checklist

### **Technical**

- [ ] Sound/Notifications implemented
- [ ] Project Cabinet implemented
- [ ] Reports implemented
- [ ] AI Assistant (rule-based) implemented
- [ ] Ivy Lee method implemented
- [ ] Time blocking implemented
- [ ] Premium polish (theme, animations)
- [ ] All tests passing
- [ ] Typecheck passing
- [ ] Build successful

### **Integration**

- [ ] Lemon Squeezy store created
- [ ] Products/variants created
- [ ] Webhook handler implemented
- [ ] Subscription database table created
- [ ] Checkout URLs configured
- [ ] Google OAuth enabled (optional)

### **Infrastructure**

- [ ] DNS propagated (moneo.bond)
- [ ] Custom domain active
- [ ] SSL certificate valid
- [ ] Supabase backups enabled
- [ ] Sentry configured
- [ ] Uptime monitoring setup
- [ ] Analytics configured

### **Security**

- [ ] RLS policies verified
- [ ] No secrets in frontend
- [ ] Dependencies audited
- [ ] CSP headers configured
- [ ] Rate limiting enabled

### **Business**

- [ ] Pricing page created
- [ ] Terms of Service reviewed
- [ ] Privacy Policy reviewed
- [ ] Refund policy defined
- [ ] Support email configured
- [ ] Legal pages linked

### **Marketing**

- [ ] Landing page copy
- [ ] Product Hunt listing prepared
- [ ] Social media accounts
- [ ] Blog content ready
- [ ] Announcement email draft

---

## 🎯 Launch Day Checklist

### **1 Hour Before Launch**

- [ ] Final health check
- [ ] Verify all integrations
- [ ] Test signup flow
- [ ] Test Pro upgrade flow
- [ ] Test payment flow (sandbox)
- [ ] Test auth flow
- [ ] Test email notifications

### **Launch Time**

- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor signup rate
- [ ] Monitor payment flow
- [ ] Be ready for support tickets
- [ ] Update social media
- [ ] Launch on Product Hunt

### **1 Hour After Launch**

- [ ] Review initial metrics
- [ ] Check for critical bugs
- [ ] Respond to first users
- [ ] Monitor server load
- [ ] Monitor payment issues

### **24 Hours After Launch**

- [ ] Review day 1 metrics
- [ ] Address all bugs
- [ ] Respond to all support tickets
- [ ] Plan iteration based on feedback
- [ ] Prepare day 2 improvements

---

## 📝 Conclusion

### **Summary**

- **Database:** Supabase (PostgreSQL) - managed, scalable
- **Authentication:** Supabase Auth - secure, extendable
- **Billing:** Lemon Squeezy - needs integration
- **Deployment:** Cloudflare Pages - fast, global
- **Monitoring:** Sentry + Uptime Robot - reliable
- **Maintenance:** Weekly reviews, monthly updates
- **Debugging:** Local tools + production monitoring

### **Key Points**

1. **Don't self-host PostgreSQL** - use Supabase for simplicity
2. **Never expose secrets** - use Supabase Edge Functions
3. **Monitor everything** - errors, uptime, metrics
4. **Test integrations** - Lemon Squeezy sandbox first
5. **Have a support plan** - email + documentation
6. **Security first** - RLS, no secrets in frontend
7. **Iterate quickly** - launch MVP, improve continuously

### **Next Steps**

1. Implement Sound/Notifications (Week 1)
2. Implement Project Cabinet (Week 2-3)
3. Configure Lemon Squeezy (Week 4)
4. Implement Reports (Week 4)
5. Implement AI Assistant (Week 5-6)
6. Polish UI/UX (Week 10)
7. **LAUNCH** (Week 11)

**Ready to start implementation?**
