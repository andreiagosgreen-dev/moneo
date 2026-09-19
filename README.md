# Moneo

A focus timer application for productivity with cloud sync.

## Features

- **Focus Timer**: Pomodoro-style timer with customizable durations
- **Session Tracking**: Log completed focus sessions with intentions and focus areas
- **Statistics**: Daily streaks, weekly charts, and growth progression
- **Focus Areas**: Organize sessions by category (Work, Study, Personal, or custom)
- **Cloud Sync**: Sync data across devices via Supabase
- **Privacy First**: Local-first storage with optional cloud backup
- **PWA Support**: Installable on desktop and mobile with offline capability
- **Account Management**: Sign in, sign out, and delete account with GDPR compliance
- **Billing**: Lemon Squeezy integration for Pro subscriptions
- **Email Notifications**: Daily summaries and focus reminders (Pro feature)
- **Cloudflare Edge**: CDN, caching, and edge functions for performance

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite 6
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Billing**: Lemon Squeezy
- **Edge**: Cloudflare Workers, KV, R2
- **Testing**: Vitest, jsdom, PGlite for integration tests
- **PWA**: Vite PWA plugin with Workbox

## Deployment

### Cloudflare Workers (Recommended)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Cloudflare setup including:

- Worker configuration
- KV cache setup
- R2 bucket for assets
- DNS configuration
- Deployment scripts

### Docker

Build and run with Docker:

```bash
docker build -t moneo .
docker run -p 80:80 -e VITE_SUPABASE_URL=your_url -e VITE_SUPABASE_ANON_KEY=your_key moneo
```

Or use Docker Compose:

```bash
docker-compose up --build
```

### Static Hosting

The `dist/` folder contains the production build. Deploy to any static hosting service:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

## Mobile App

See [MOBILE.md](./MOBILE.md) for React Native implementation guide.

## Environment Variables

### Web (.env.local)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LEMONSQUEEZY_STORE_ID=your-store-id
VITE_LEMONSQUEEZY_CHECKOUT_URL=https://your-store.lemonsqueezy.com/checkout
```

### Cloudflare Workers (wrangler.toml)

Update with your actual IDs after setup:

```toml
id = "your-actual-kv-id"
preview_id = "your-preview-kv-id"
```

## Legal

- Privacy Policy: `/privacy`
- Terms of Service: `/terms`

## License

Private
