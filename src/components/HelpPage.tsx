import { Link } from 'react-router-dom';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Timer',
    body: 'Pick Focus, Short or Long. Set an intention, choose an area, project and task, then press Space. Sessions credit automatically to everything selected.',
  },
  {
    title: 'Ivy Lee + Frog + Matrix',
    body: 'Plan up to 6 tasks nightly (Free: 3) and reorder with ▲▼. The Frog card picks your hardest task. The Matrix auto-sorts by urgency/importance; Pro can override quadrants.',
  },
  {
    title: 'Calendar',
    body: 'Recurring weekly blocks with adherence %. Overlapping blocks get a ⚠ flag. Switch Week/List views. Creating blocks is Pro.',
  },
  {
    title: 'Projects & tasks',
    body: 'Projects hold tasks with status, P0–P3, subtasks (3 levels, WBS-numbered), blockers, recurrence, due dates, notes, links, points and milestones. Templates jump-start new projects.',
  },
  {
    title: 'Agile',
    body: 'Board: drag cards between columns, WIP limits and flow metrics (Pro). Sprints: plan 1–4 weeks, burndown, velocity, auto standup, retros. Timeline: Gantt with critical path. Waterfall: gated sequential phases.',
  },
  {
    title: 'Goals & OKRs',
    body: 'Goals cascade Vision → Weekly with auto rollup; generate starter tasks or send one to today’s plan. OKRs track quarterly key results with sliders.',
  },
  {
    title: 'AI path',
    body: 'Plan tab: describe a goal or skill, answer up to 3 questions, review the visual draft, then approve. At most one project and 20 tasks per approval; week drafts never overfill a day. Runs 100% on-device; auto-prepare is opt-in. After sessions, 4-tap feedback tunes future estimates.',
  },
  {
    title: 'Assistant',
    body: 'Ask “what should I work on?” or type “add task Draft proposal p1 tomorrow for Client”. Free gets 2 quick actions; Pro unlocks full chat.',
  },
  {
    title: 'Reports',
    body: '7/30-day breakdowns by project and area, 80/20 callout, CSV export and printable PDF with billable totals.',
  },
  {
    title: 'Life map',
    body: 'Map tab: score 5–9 life areas Now vs Want, weighted by importance. The wheel shows balance and the biggest gap; one 10-minute step lands in today’s plan. Weekly review shows what got attention. Start from a template (Balanced, Student, Freelancer, Founder, Recovery) or blank. Local-only: never synced, never emailed.',
  },
  {
    title: 'Life',
    body: 'Habits with streaks and evening reminders. Balance scores real time across 5 life areas. Journal with mood and gratitude. Energy check-ins reveal peak hours (Pro).',
  },
  {
    title: 'Skills & billing',
    body: 'Track skill levels 1–5 with resources. Mark projects billable with an hourly rate — amounts appear in stats, reports and PDF exports.',
  },
  {
    title: 'Privacy & data',
    body: 'Everything lives on your device first (localStorage). Sign in to sync via Supabase. Export CSV anytime; clearing history is locked while sync is on.',
  },
];

export default function HelpPage() {
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 pb-10 pt-10 sm:px-6">
      <Link to="/" className="press font-mono text-[12px] text-sage hover:text-cream">
        ← Back to Moneo
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-cream">
        Help center
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-sage">
        Every card in one page. Nothing here leaves your device.
      </p>
      <div className="mt-6 space-y-3">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="rounded-xl bg-ink/40 px-5 py-4 ring-1 ring-inset ring-line"
          >
            <h2 className="font-display text-[16px] font-bold text-cream">{s.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-sage">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
