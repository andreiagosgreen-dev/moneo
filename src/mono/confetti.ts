/* Tiny canvas confetti — no dependency, ~2 KB. Soft, slow and short: a few
 * dozen small pieces in the atmosphere's own colors that drift down and fade
 * out in under two seconds. Physics are pure so they can be unit-tested.
 */

export interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  /** Remaining life, 1 → 0. */
  life: number;
}

export const GRAVITY = 520; // px/s²
export const DRAG = 1.6; // 1/s
export const LIFETIME = 1.8; // s

/** Deterministic PRNG (mulberry32) — same seed, same burst. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A burst fanning out and upward from (x, y). */
export function makeBurst(
  count: number,
  x: number,
  y: number,
  colors: string[],
  rand: () => number,
): Piece[] {
  const palette = colors.length > 0 ? colors : ['#888'];
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    // Mostly upward, spread ±70° around vertical.
    const angle = -Math.PI / 2 + (rand() - 0.5) * (Math.PI * 0.78);
    const speed = 260 + rand() * 300;
    out.push({
      x: x + (rand() - 0.5) * 60,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rand() * Math.PI,
      vr: (rand() - 0.5) * 10,
      w: 5 + rand() * 4,
      h: 3 + rand() * 3,
      color: palette[Math.floor(rand() * palette.length) % palette.length],
      life: 1,
    });
  }
  return out;
}

/** Advance every piece by `dt` seconds; drops the ones that have faded. */
export function step(pieces: Piece[], dt: number): Piece[] {
  const k = Math.exp(-DRAG * dt);
  const out: Piece[] = [];
  for (const p of pieces) {
    const life = p.life - dt / LIFETIME;
    if (life <= 0) continue;
    out.push({
      ...p,
      vx: p.vx * k,
      vy: p.vy * k + GRAVITY * dt,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      rot: p.rot + p.vr * dt,
      life,
    });
  }
  return out;
}

/** Paint one burst on `canvas`; returns a cancel function. */
export function runConfetti(
  canvas: HTMLCanvasElement,
  opts: { count: number; originY: number; colors: string[]; seed: number },
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx || opts.count <= 0) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let pieces = makeBurst(opts.count, w / 2, opts.originY, opts.colors, rng(opts.seed));
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pieces = step(pieces, dt);
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.6) * 0.9;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (pieces.length > 0) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, w, h);
  };
}
