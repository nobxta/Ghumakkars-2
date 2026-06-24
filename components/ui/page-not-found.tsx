'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

// Animated 404 — Ghumakkars purple theme.
// A smooth white "reveal sweep" wipes in over the brand gradient, then the
// message fades in. No characters — just a clean, premium reveal.
export default function NotFoundPage() {
  return (
    <div className="w-full min-h-[100svh] bg-gradient-to-br from-[#7C3AED] to-[#9333EA] overflow-hidden flex justify-center items-center relative">
      <RevealSweep />
      <MessageDisplay />
    </div>
  );
}

// ── Message + actions ──
function MessageDisplay() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col justify-center items-center px-6">
      <div
        className={`flex flex-col items-center text-center transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div
          className="text-[clamp(64px,18vw,128px)] font-extrabold leading-none bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(135deg,#7C3AED,#9333EA)' }}
        >
          404
        </div>
        <h1 className="mt-2 text-xl sm:text-3xl font-bold text-[#0F172A]">Page Not Found</h1>
        <p className="mt-3 max-w-md text-sm sm:text-base text-[#64748B] leading-relaxed">
          This page might have been deleted or no longer exists.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-8">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-all duration-300 px-5 sm:px-6 py-2.5 text-sm sm:text-base font-semibold active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Go Back
          </button>
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6d28d9] transition-all duration-300 px-5 sm:px-6 py-2.5 text-sm sm:text-base font-semibold active:scale-95 shadow-lg shadow-purple-500/30"
          >
            <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

// ── White reveal sweep (canvas) ──
// Crisp (device-pixel-ratio aware) circles that ease-out and sweep left→right,
// merging into a full white background. Re-runs and rescales on resize.
type Bubble = { x: number; y: number; delay: number; target: number };

function RevealSweep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let startTs = 0;
    const DURATION = 1300; // ms
    let W = 0;
    let H = 0;
    let bubbles: Bubble[] = [];

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // crisp but capped for perf
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const diag = Math.hypot(W, H);
      // Density scales with screen so it always fully covers (mobile → desktop).
      const count = Math.round(Math.min(140, Math.max(60, (W * H) / 16000)));
      bubbles = [];
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W;
        bubbles.push({
          x,
          y: Math.random() * H,
          // left starts first → smooth left-to-right sweep, with a little jitter
          delay: (x / W) * 0.5 + Math.random() * 0.12,
          target: diag * (0.16 + Math.random() * 0.16),
        });
      }
    };

    const draw = (now: number) => {
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / DURATION);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (const b of bubbles) {
        const local = (p - b.delay) / (1 - b.delay);
        if (local <= 0) continue;
        const r = easeOutCubic(Math.min(1, local)) * b.target;
        if (r <= 0) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p < 1) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.fillRect(0, 0, W, H); // guarantee a clean, fully-white finish
      }
    };

    const run = () => {
      cancelAnimationFrame(raf);
      startTs = 0;
      setup();
      raf = requestAnimationFrame(draw);
    };

    run();
    window.addEventListener('resize', run);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', run);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
