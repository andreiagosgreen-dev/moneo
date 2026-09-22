/**
 * Moneo brand mark — an open orbital ring carrying a continuous "M" stroke,
 * with a single accent bead marking the round in progress. Pure inline SVG;
 * the bead is tinted by the live mode accent via CSS custom properties.
 */
export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="brand-mark"
      style={{ filter: 'drop-shadow(0 0 6px rgb(var(--accent-rgb) / 0.45))' }}
    >
      {/* open orbital ring */}
      <circle
        cx="16"
        cy="16"
        r="10.5"
        stroke="#fbfcff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeDasharray="55 11"
        transform="rotate(-15 16 16)"
      />
      {/* continuous M stroke */}
      <path
        d="M11 20.5V12.8L16 17.3L21 12.8V20.5"
        stroke="#fbfcff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the round in progress — tinted by the active mode */}
      <circle className="mark-accent" cx="23.4" cy="8.6" r="2.3" fill="var(--accent)" />
    </svg>
  );
}
