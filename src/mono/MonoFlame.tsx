/** Small streak flame; decorative, inherits colour from `.mono-flame`. */
export default function MonoFlame({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="mono-flame"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M8.2 1c.3 2.1-.7 3.4-1.8 4.6C5.3 6.8 4 8.1 4 10.1 4 12.8 5.8 15 8 15s4-2 4-4.7c0-1.6-.7-2.9-1.5-3.8.1 1.2-.4 2.1-1.2 2.5.4-2.9-.6-5.6-1.1-8zM8 13.6c-1 0-1.8-.9-1.8-2 0-1.3 1-2 1.7-3 .2 1 .9 1.4 1.4 2 .3.4.5.8.5 1.2 0 1-.8 1.8-1.8 1.8z" />
    </svg>
  );
}
