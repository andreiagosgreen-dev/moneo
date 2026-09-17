# Moneo — Roadmap & Live Status

> **Last audit: 2026-09-17.** Suite: 572 tests / 568 passing / 1 date-sensitive
> failure (queued for fix, Etapa 0) / 3 skipped. Typecheck, lint, build green.
> ~3,000 lines of finished work pending commit (Ivy reorder ▲▼, Help center at
> `/help`, weekly-capacity migration 0005, insights/assistant/energy/goals improvements).

**Legend:**

- ✅ **100%** — done, tested, shipped
- 🟡 **n%** — done but incomplete; the "Left:" line says exactly what's missing
- ❌ **0%** — not started (deliberately deferred or planned)

---

## 1. Snapshot

Moneo is a local-first productivity OS: everything lives on-device
(localStorage), cloud sync via Supabase is opt-in after login, and Pro unlocks
the full feature set through Lemon Squeezy.

All **8 monetizable features** from `MONETIZATION-PLAN.md` are built and
gated. The gaps that block revenue are **business plumbing, not product**:
checkout without a variant id, no billing portal, ungated exports, no public
pricing page. Those are Etapa 0 below.

---

## 2. Feature Status (audited against code, not wishful thinking)

### Core product (Roadmap Phase 1–2)

| Feature | Status | Left |
| --- | --- | --- |
| Pomodoro timer + engine | ✅ 100% | — |
| Focus areas + user-scoped cloud identity | ✅ 100% | — |
| Session tracking, stats, streaks | ✅ 100% | — |
| Cloud sync (Supabase, local-first, merge engine, RLS migrations 0001–0005) | ✅ 100% | — |
| PWA (manifest, icons, offline, installable) | ✅ 100% | — |
| Project Cabinet (CRUD, colors, categories, per-session tracking) | ✅ 100% | — |
| Advanced tasks (3-level WBS subtasks, blockers, recurrence, P0–P3, milestones, points) | ✅ 100% | — |
| Billable rates + billable totals in stats/reports | ✅ 100% | — |
| Account management | 🟡 90% | Billing portal (manage/cancel subscription) missing in AccountButton |
| Sound & notifications | 🟡 85% | Email notifications are a console-log placeholder; browser notifications + scheduling + custom sound upload are done |
| Skills tracking | 🟡 90% | LinkedIn skill sync (Roadmap 1.2) not built |

### Time intelligence (Roadmap Phase 3)

| Feature | Status | Left |
| --- | --- | --- |
| Ivy Lee method (3 free / 6 Pro, carry-over, reorder ▲▼, analytics) | ✅ 100% | — |
| Eat the Frog (deterministic pick, streaks, procrastination analytics) | ✅ 100% | — |
| Eisenhower Matrix (auto quadrants, Pro override, time-per-quadrant) | 🟡 90% | No drag-drop onto quadrants (override is via controls) |
| Rule-based assistant + insights (80/20 Pareto, best window, deadlines) | 🟡 75% | See AI assistant section |
| Time blocking (blocks, adherence, conflict detection) | 🟡 85% | Google/Outlook Calendar integration deferred (needs OAuth) |

### AI assistant & goals (Roadmap Phase 4)

| Feature | Status | Left |
| --- | --- | --- |
| Chat UI, quick actions, Pro gating, personality tones, history cap | ✅ 100% | — |
| Voice input (Web Speech) + TTS output | ✅ 100% | Recognition/TTS language not pinned to UI locale |
| NL task creation ("add task X p1 tomorrow for Client") | ✅ 100% | — |
| Context awareness (tasks, projects, history, goals, energy peaks) | ✅ 100% | Data context only |
| Task **modification** intents (done/reschedule/delete via chat) | ❌ 0% | Biggest UX gap — chat can only create |
| Dialog context (follow-ups like "add another one", "make it p0") | ❌ 0% | Each message parsed in isolation |
| Rich date parsing (weekdays, "on the 15th", "next month") | ❌ 0% | Only today/tomorrow/next week/in N days |
| Fuzzy intent matching (typos, rephrasing) | ❌ 0% | Rigid regex, order-dependent |
| Goal breakdown via chat (Roadmap 4.3) | 🟡 50% | Starter tasks exist in GoalsCard only, not exposed in chat |
| Goals hierarchy (Vision→Weekly, auto rollup, starter tasks) | 🟡 85% | No goal conflict resolution / dependency management (Roadmap 4.2) |

### Life management (Roadmap Phase 5)

| Feature | Status | Left |
| --- | --- | --- |
| Habits (daily/weekly, stacking, streaks, reminders) | ✅ 100% | — |
| Life areas balance (5 areas, computed from real session history) | ✅ 100% | — |
| Journal (mood, prompts, gratitude, weekly summaries) | ✅ 100% | — |
| Energy management (1–10 check-ins, peak-hour detection) | ✅ 100% | — |
| Work-life balance (ratio, disconnect reminders, burnout signals) | 🟡 90% | Vacation planning not built |

### Enterprise PM (Roadmap Phase 7)

| Feature | Status | Left |
| --- | --- | --- |
| Kanban (drag-drop, custom columns, Pro WIP limits + flow metrics) | 🟡 90% | No swimlanes |
| Sprints (planning, burndown, velocity, auto standup, retros) | ✅ 100% | — |
| OKRs (cascade, quarterly, sliders, free limit) | ✅ 100% | — |
| Gantt + critical path | ✅ 100% | — |
| Waterfall (gated sequential phases, risk, exit criteria) | ✅ 100% | — |

### Money & infrastructure

| Feature | Status | Left |
| --- | --- | --- |
| Lemon Squeezy webhook (HMAC verify fail-closed, subscription upsert) | ✅ 100% | — |
| Entitlement checks (isPro → gates across the app) | ✅ 100% | — |
| **Checkout (variant_id mapping monthly/yearly)** | ❌ 0% | **Launch blocker** — upgrade URL has no product variant; both plans produce the same URL |
| **Billing portal (manage/cancel)** | ❌ 0% | **Launch blocker** for recurring subscriptions |
| **Export gating (CSV/PDF on Pro)** | ❌ 0% | Contradicts pricing copy; decide: gate or reword |
| Public `/pricing` route + comparison table | 🟡 40% | PricingCard exists only inside account dropdown |
| Premium polish (themes, fonts, onboarding wizard, help center) | 🟡 85% | `/pricing` route, feature-comparison table |
| CI/CD (lint, typecheck, tests, Cloudflare deploy) | ✅ 100% | Deploy secrets not yet set in GitHub (ops task) |
| SEO/launch assets (OG meta, robots, sitemap, icons) | ✅ 100% | — |

### Pre-launch workstreams (agreed plan, not yet started)

| Workstream | Status | Scope |
| --- | --- | --- |
| i18n (RO/EN/ES/FR/IT/RU/UK) | ❌ 0% | react-i18next, extract ~10k lines of UI strings, refactor text generators; RO+EN full, others MT-draft + review. Assistant commands stay EN in v1 |
| Maintenance & observability | ❌ 0% | Sentry, conversion analytics (signup/upgrade/checkout events), health check, version badge, maintenance-mode flag, Supabase backups |
| QA / E2E ("virtual tests") | 🟡 35% | 572 unit tests + pgTAP RLS tests + CI exist; **missing**: Playwright E2E on critical flows, staging env, mobile-viewport runs |
| Security hardening | 🟡 55% | RLS on all tables, HMAC fail-closed webhook done; **missing**: deep security scan, CSP/security headers, worker rate limiting, npm audit + Dependabot, secrets-in-bundle review |
| Responsive (phones + tablets) | 🟡 50% | Tailwind breakpoints used but never audited; fix narrow screens before E2E |
| Beta / trials | ❌ 0% | UAT checklist, 10–20 beta testers + feedback form, optional 7-day Pro trial |

---

## 3. Path to Launch (the plan)

### Etapa 0 — Close the code gaps (1–2 days)

1. Fix the date-sensitive Ivy test → commit the pending ~3,000-line package.
2. Checkout with real Lemon Squeezy `variant_id` mapping (monthly/yearly), tested in test mode.
3. Billing portal (manage/cancel) in AccountButton.
4. Gate CSV/PDF export behind Pro (aligns with pricing copy).
5. Public `/pricing` route with Free-vs-Pro comparison table.

### Etapa 1 — Premium: multilingual + assistant + maintenance (1.5–2 weeks)

6. Assistant premium: modify-task intents, 2–3 turn dialog context, rich dates.
7. i18n infrastructure + string extraction; RO/EN complete; ES/FR/IT/RU/UK MT-draft.
8. Responsive audit + fixes (phones/tablets).
9. Observability: Sentry, conversion analytics, health/version/maintenance mode, backups.

### Etapa 2 — QA, debug & security (~1 week)

10. Sentry wired into sync/billing errors; debug mode with verbose sync logs.
11. Playwright E2E: timer→session→sync, auth, Free/Pro gates, checkout→webhook→Pro.
12. Staging environment (separate Supabase project + preview deploy), E2E in CI.
13. Deep security scan + remediation; CSP headers, rate limiting, npm audit, Dependabot.
14. UAT checklist (desktop + mobile PWA, Chrome/Safari/Firefox); beta testers; decide Pro trial.

### Etapa 3 — Launch ops (~1 week)

15. GitHub Actions secrets → production deploy + run migrations 0001–0005 + DNS (moneo.bond).
16. Real payment test (own card) + live webhook verification.
17. Product Hunt copy, social posts, final onboarding review.

**Total: ~4–5 weeks to launch.**

---

## 4. Post-launch queue (Etapa 4, in this order)

1. Feedback-driven bugfixes + conversion metrics review (see MONETIZATION-PLAN).
2. Assistant: fuzzy intents, goal breakdown in chat, multilingual commands.
3. Complete i18n review pass for ES/FR/IT/RU/UK with native speakers.
4. Native wrappers over the same codebase: **Capacitor** (Android/iOS) + **Tauri** (Windows) — one codebase, never separate rewrites. Unlocks native push notifications, timer widget, store presence.
5. LLM fallback for the assistant (Phase 6) behind a feature flag, cost-capped.
6. Teams tier ($29) once individual Pro is proven.

---

## 5. Explicitly deferred (frozen until post-PMF)

| Item | Why frozen |
| --- | --- |
| Google/Outlook Calendar sync | Needs OAuth credentials; internal weekly blocks ship instead |
| Phase 6 full AI (quizzes, spaced repetition, knowledge graph, Slack/email integration) | Needs LLM budget; rule-based coach ships meanwhile |
| Enterprise tier (SSO, API, custom models) | No market signal yet |
| LinkedIn skill sync | Niche ask |
| Swimlanes, drag-drop quadrants | Polish items, low conversion impact |

---

## 6. Quality bar (unchanged)

- < 3s page load, < 100ms interaction response, 99.9% uptime target
- Every feature ships with tests; CI must stay green (lint, typecheck, tests, build)
- Documentation updated with every phase (this file, MONETIZATION-PLAN, OPERATIONS-GUIDE)
- Revenue targets and conversion metrics: see `MONETIZATION-PLAN.md`
