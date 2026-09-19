/**
 * Calm loading skeleton for lazily-loaded tabs (Roadmap Faza 1.3).
 * Static placeholder — no spinners, no layout shift beyond its own box.
 */
export default function TabFallback({ label }: { label: string }) {
  return (
    <main
      className="mt-2 grid items-start gap-6 md:grid-cols-2"
      aria-busy="true"
      aria-label={`${label} loading`}
    >
      {[0, 1].map((i) => (
        <div key={i} className="card animate-pulse px-6 py-6 sm:px-7" aria-hidden>
          <div className="h-5 w-32 rounded bg-cream/10" />
          <div className="mt-3 h-3 w-48 rounded bg-cream/5" />
          <div className="mt-4 space-y-2">
            <div className="h-10 rounded-xl bg-cream/5" />
            <div className="h-10 rounded-xl bg-cream/5" />
          </div>
        </div>
      ))}
    </main>
  );
}
