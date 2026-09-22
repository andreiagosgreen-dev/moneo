/**
 * Moneo brand mark — the terracotta "m" plate from /brand/moneo-mark-1200.png.
 * Served from public/ so the same asset powers favicon, PWA, and UI.
 */
export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/brand/moneo-mark-1200.png"
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="brand-mark"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
    />
  );
}
