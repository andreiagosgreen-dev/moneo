import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number;
  phase: number;
}

interface Props {
  /** Boosts ambient energy & adds subtle orbital ripples while a Focus session runs. */
  focusing?: boolean;
  /** CSS selector or element scope; updates `--mx`/`--my` cursor spotlight on `.atm-root`. */
  spotlight?: boolean;
}

/**
 * 60fps Holographic Neural & Orbital Canvas Engine + Cursor Spotlight.
 * - Reads active atmosphere `--mono-accent` live from CSS (adapts to all 42 skins).
 * - Automatically pauses when tab is hidden and disables under `prefers-reduced-motion`.
 * - Zero dependencies, SSR/JSDOM safe, pointer-events: none.
 */
export default function MonoVisualEngine({ focusing = false, spotlight = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusRef = useRef(focusing);
  focusRef.current = focusing;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const mouse = { x: -9999, y: -9999, active: false };
    let width = window.innerWidth;
    let height = window.innerHeight;
    let rafId = 0;
    let running = !document.hidden;

    const parseAccentRgb = (): [number, number, number] => {
      const root = document.querySelector<HTMLElement>('.atm-root') ?? document.documentElement;
      const raw = getComputedStyle(root).getPropertyValue('--mono-accent').trim();
      if (raw.startsWith('#')) {
        const hex = raw.slice(1);
        const full =
          hex.length === 3
            ? hex
                .split('')
                .map((c) => c + c)
                .join('')
            : hex;
        if (full.length === 6) {
          const n = Number.parseInt(full, 16);
          if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
      }
      return [56, 189, 248];
    };

    let accent = parseAccentRgb();
    let frameCount = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const count = width < 768 ? 26 : 54;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      r: 1.1 + Math.random() * 1.9,
      depth: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    }));

    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      if (spotlight) {
        const root = document.querySelector<HTMLElement>('.atm-root');
        if (root) {
          root.style.setProperty('--mx', `${e.clientX}px`);
          root.style.setProperty('--my', `${e.clientY}px`);
        }
      }
    };

    const onPointerLeave = () => {
      mouse.active = false;
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running && !rafId) rafId = window.requestAnimationFrame(draw);
    };

    const draw = (time: number) => {
      rafId = 0;
      if (!running) return;
      frameCount += 1;
      // Re-sample atmosphere accent color every ~45 frames in case user switches skins.
      if (frameCount % 45 === 0) accent = parseAccentRgb();

      const [r, g, b] = accent;
      const isFocus = focusRef.current;
      ctx!.clearRect(0, 0, width, height);

      // Subtle holographic orbital ripples when a Focus session is actively running
      if (isFocus) {
        const cx = width * 0.5;
        const cy = height * 0.44;
        for (let k = 0; k < 3; k++) {
          const cycle = (time * 0.00018 + k / 3) % 1;
          const rad = 120 + cycle * Math.min(width, height) * 0.48;
          const alpha = (1 - cycle) * 0.14;
          ctx!.beginPath();
          ctx!.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          ctx!.lineWidth = 1.2;
          ctx!.stroke();
        }
      }

      // Update & draw floating holographic nodes
      const linkDist = width < 768 ? 115 : 150;
      const mouseDist = 185;
      const speedMul = isFocus ? 1.45 : 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.x += p.vx * p.depth * speedMul;
        p.y += p.vy * p.depth * speedMul;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Gentle magnetic pull toward pointer
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1600 && d2 < mouseDist * mouseDist) {
            const d = Math.sqrt(d2);
            p.x += (dx / d) * 0.28 * p.depth;
            p.y += (dy / d) * 0.28 * p.depth;
          }
        }

        const pulse = 0.55 + 0.45 * Math.sin(time * 0.0018 + p.phase);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.22 + 0.36 * p.depth * pulse).toFixed(3)})`;
        ctx!.fill();

        // Neural filaments between nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * (isFocus ? 0.2 : 0.13);
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(q.x, q.y);
            ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
            ctx!.lineWidth = 0.8;
            ctx!.stroke();
          }
        }

        // Crisp interactive filaments from cursor to nearby nodes
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mouseDist * mouseDist) {
            const alpha = (1 - Math.sqrt(d2) / mouseDist) * 0.28;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
            ctx!.lineWidth = 1;
            ctx!.stroke();
          }
        }
      }

      rafId = window.requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    rafId = window.requestAnimationFrame(draw);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [spotlight]);

  return <canvas ref={canvasRef} className="mono-engine-canvas" aria-hidden="true" />;
}
