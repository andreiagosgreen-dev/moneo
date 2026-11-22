/**
 * Moneo geometric SVG brand mark — crisp obsidian squircle + luminous M monogram + zenith apex.
 * Served from public/brand/moneo-mark.svg across favicon, nav, landing, and account pages.
 */
export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/brand/moneo-mark.svg"
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="brand-mark"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    />
  );
}
