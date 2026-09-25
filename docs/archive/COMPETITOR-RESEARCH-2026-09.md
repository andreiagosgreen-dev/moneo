# Moneo — Competitor Research (2026-09)

> Scope: Motion, Sunsama, Akiflow, Reclaim.ai — the four AI-scheduling/daily-planning
> apps most often mentioned as Moneo's category. Web research only (no product
> access), current as of September 2026. Purpose: ground the Projects redesign
> (Roadmap item 5) and the visual redesign pass (item 6) in what actually wins
> or loses users in this space, not assumptions.

## 1. Snapshot table

| App               | Core idea                                                   | Price/mo                           | Free plan               | Biggest strength                                                             | Biggest complaint                                                                      |
| ----------------- | ----------------------------------------------------------- | ---------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Motion**        | AI auto-schedules tasks onto your real calendar             | $19–29 (no monthly-only under $29) | None — 7-day trial only | Deadline-aware auto-scheduling actually works                                | Nickel-and-diming pricing tiers; AI reshuffles your day without warning                |
| **Sunsama**       | Manual daily planning ritual across all your other tools    | $20–25                             | None — 14-day trial     | Most thoughtfully designed daily-shutdown ritual in the category             | $25/mo with zero free tier — high commitment before you know it'll stick               |
| **Akiflow**       | Central inbox → drag tasks onto calendar yourself           | $19–34                             | None — 7-day trial      | Cleanest, least overwhelming UI in the group                                 | All planning is manual — gets overwhelming once the task list fills up                 |
| **Reclaim.ai**    | AI defends Focus Time + Habits as calendar blocks           | Free / $10 / $15 / $22 per seat    | Yes (Lite)              | Only one with a real free tier; Habits-as-calendar-blocks is genuinely novel | No native mobile app in 2026; US-only data residency                                   |
| **Moneo (today)** | Pomodoro + goals hierarchy + PM + life balance, local-first | Free / **$9** / $7.50 (yearly)     | Yes                     | Cheapest by far; only one that's local-first with no forced account          | No calendar sync/auto-scheduling at all — the one thing all four competitors center on |

Sources: [Motion review](https://ellieplanner.com/comparisons/motion-app-review), [Motion pricing](https://get-alfred.ai/blog/motion-pricing), [Sunsama review](https://clickup.com/learn/topic/productivity/tools/sunsama/), [Sunsama pricing](https://www.morgen.so/blog-posts/sunsama-pricing), [Akiflow pricing](https://akiflow.com/pricing), [Akiflow review](https://thebusinessdive.com/akiflow-review), [Reclaim pricing](https://reclaim.ai/pricing), [Reclaim features](https://pipeline.zoominfo.com/sales/reclaim-ai-features), [Motion vs Akiflow complexity](https://efficient.app/compare/motion-vs-akiflow), [Akiflow complaints](https://www.saner.ai/blogs/sunsama-vs-akiflow).

## 2. What each one actually is (past the marketing)

**Motion** — sits between your task list and calendar; its AI slots tasks into open time and reshuffles in real time as things change. Also ships AI Docs and an AI note-taker (feature creep beyond scheduling). No plan under $19/seat/mo, no free tier, only a 7-day trial. Users describe the pricing as confusing/"nickel-and-diming" and are actively migrating to Reclaim, Sunsama, Morgen, or ClickUp over it.

**Sunsama** — explicitly _not_ a task manager: a planning _layer_ on top of Asana/ClickUp/Trello/Jira/Notion/Linear/Todoist/your calendar. Morning ritual: pull tasks in, estimate durations, see if the day fits, timebox onto your real Google/Outlook calendar. Ends with a daily shutdown review. Most reviewers call it the best-designed daily planner in the category — but $20–25/mo with zero free tier is the recurring objection.

**Akiflow** — a command-bar-driven inbox that aggregates tasks from many tools; you manually drag everything onto a calendar. Cleanest UI of the four (reviewers explicitly recommend it over Motion for users who get overwhelmed by busy interfaces) — but because _nothing_ is automatic, the workflow degrades as the task list grows.

**Reclaim.ai** — the calendar defends itself: Focus Time blocks, and — most interesting for Moneo — **Habits** (exercise, learning, admin) get turned into flexible calendar blocks that Reclaim protects and reschedules around meetings, instead of a habit tracker that's disconnected from your actual free time. Only one of the four with a real free tier. No mobile app is a real gap for them.

## 3. Cross-cutting findings

### 3.1 Pricing: Moneo is already winning this axis, don't give it up

Every competitor charges **$19–34/month** (or $10–22/seat) with **no free tier** except Reclaim's limited Lite plan. Moneo Pro is **$9/mo ($7.50 yearly)** — roughly a third of the category's floor — with a genuinely usable free tier. This isn't a minor edge; it's the single most-repeated complaint about all three paid-only competitors ("hard to justify," "commit before you know it'll stick"). **Recommendation: keep the price gap visible in `/pricing` messaging** — "same idea, a third of the price" is a real, defensible claim, not marketing fluff.

### 3.2 The one feature all four have and Moneo doesn't: real calendar sync

Motion and Reclaim auto-schedule onto Google/Outlook; Sunsama and Akiflow let you manually timebox onto it. Moneo's `ROADMAP.md` already flags "Google/Outlook Calendar integration deferred (needs OAuth)" under time blocking — this research confirms that's not a nice-to-have, it's the category's table stakes. **This is the single highest-leverage gap to close**, independent of the Projects/visual work — it's more likely to affect conversion than any visual redesign.

### 3.3 Complexity backlash is real — and it's a lane Moneo already occupies

Motion is losing users specifically to _simpler_ competitors because its AI reshuffles days without warning and crams in docs/notes/scheduling/meetings. Akiflow wins reviewers specifically for being the calm, minimal option — but loses them once manual planning doesn't scale. Moneo's calm/glass aesthetic (already validated as on-trend, see §4) plus **progressive disclosure** (`isEngagedUser`, `<Disclosure>` wrapping advanced views) is structurally the right answer to this backlash — new users get the calm core, power users unlock Agile/OKR/Gantt. **Don't let the Projects redesign (item 5) undo this** by surfacing Gantt/dependencies by default; keep it behind the existing disclosure pattern.

### 3.4 Reclaim's "Habits as protected calendar blocks" is worth studying, not copying wholesale

Moneo already has Habits (`src/components/life/HabitsTab.tsx`) and Life Map balance — genuinely ahead of Motion/Sunsama/Akiflow, none of which touch life-balance at all. Reclaim's twist — a habit isn't just tracked, it's actively defended as calendar time — is the one idea from this research that extends something Moneo already has, rather than requiring a new pillar. Worth a future (not this-phase) exploration once calendar sync (§3.2) exists at all, since it's meaningless without a real calendar to protect time on.

### 3.5 None of the four combine PM (Gantt/Agile/OKR) with personal planning

This is Moneo's stated strategy ("combine instead of inventing a new idea") and the research confirms it's genuine white space — Motion/Sunsama/Akiflow/Reclaim are all calendar-and-tasks tools with zero project-management depth (no Gantt, no sprints, no OKRs). Moneo's Projects/Agile/OKR stack is a real differentiator _if_ it stays reachable without breaking the calm-core experience (see §3.3). This directly supports doing the Projects redesign (item 5) — it's leaning into a gap, not chasing competitors.

## 4. Visual design direction: validated, not guesswork

2026 UI trend research independently confirms the "calm, glass, low-stimulus" direction already chosen for Moneo:

- "Low-stimulus UI" and "calm interfaces" are named 2026 trends in their own right, explicitly reacting against the maximalism of the early 2020s.
- Glassmorphism has a **hybrid** 2026 revival — frosted-glass backgrounds paired with high-contrast text, not the flat translucent overuse of ~2021. Worth checking Moneo's current glass/glow effects against this (high-contrast text over glass, not glass-on-glass).
- The stated direction — "motion that explains, typography that breathes" — lines up with the animated wheel/trend work already shipped in Life Map and Reports.

Sources: [UX/UI trends 2026 — calm interfaces](https://elements.envato.com/learn/ux-ui-design-trends), [Mobile UI/UX trends 2026](https://www.designstudiouiux.com/blog/mobile-app-ui-ux-design-trends/).

**Recommendation for item 6 (visual redesign):** don't treat this as "make it prettier" — treat it as "increase contrast, reduce simultaneous motion/glow layers, keep the glass." The current direction doesn't need to change; execution sharpness is the gap, matching what the original Faza 8 audit already concluded.

## 5. Suggested priority order coming out of this research

1. **Calendar sync (Google/Outlook)** — closes the one gap every competitor has that Moneo doesn't; higher expected impact on conversion than either remaining roadmap item below.
2. **Projects redesign (item 5)** — lean into the PM-depth white space (§3.5), but gate advanced views behind the existing `Disclosure` pattern so it doesn't compromise the calm-core lane that's currently winning against Motion's complexity backlash.
3. **Visual redesign (item 6)** — contrast + motion-layer discipline, not a new direction; the current aesthetic is already on-trend per §4.
