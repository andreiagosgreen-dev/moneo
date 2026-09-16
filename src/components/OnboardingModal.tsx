import { useState } from 'react';

const STEPS = [
  {
    title: 'One intention at a time',
    body: "Before each round, name what you're focusing on. Moneo keeps everything else out of the way.",
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.9 4.9L19 9.6l-4.3 3.1 1.5 5.1L12 15l-4.2 2.8 1.5-5.1L5 9.6l5.1-1.7z" />
      </svg>
    ),
  },
  {
    title: 'Rounds in, growth out',
    body: 'Complete focus rounds and watch your growth ring build day after day. Reports, insights and streaks keep you honest.',
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    title: 'Plan it, then do it',
    body: "Pick tonight's top tasks, eat the frog first, and let the Eisenhower matrix sort the rest. Projects, goals and sprints track the bigger picture.",
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 4v16M4 9h5M4 15h5" />
        <path d="M13.5 12.5l2.5 2.5 4-4.5" />
      </svg>
    ),
  },
  {
    title: 'Private by design',
    body: 'Everything lives on your device first. Sign in when you want cloud sync between devices — your round history stays yours.',
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Moneo"
    >
      <div className="dialog-pop card w-full max-w-sm px-6 py-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-cream ring-1 ring-line bg-ink/40">
          {s.icon}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-cream">
          {s.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-sage">{s.body}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 22 : 6,
                background: i === step ? 'var(--accent)' : 'var(--color-line)',
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {!last && (
            <button
              onClick={onDone}
              className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px]"
            >
              Skip
            </button>
          )}
          <button
            onClick={() => (last ? onDone() : setStep(step + 1))}
            className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold"
          >
            {last ? 'Start focusing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
