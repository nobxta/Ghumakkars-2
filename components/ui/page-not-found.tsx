'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

// Animated 404 page — Ghumakkars purple theme.
// White circles sweep in to reveal the message; playful stick figures run across.
export default function NotFoundPage() {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#7C3AED] to-[#9333EA] overflow-x-hidden flex justify-center items-center relative">
      <MessageDisplay />
      <CharactersAnimation />
      <CircleAnimation />
    </div>
  );
}

// 1. Message + actions
function MessageDisplay() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute flex flex-col justify-center items-center w-[90%] h-[90%] z-[100] px-4">
      <div
        className={`flex flex-col items-center text-center transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-2xl sm:text-[35px] font-semibold text-[#0F172A]">Page Not Found</div>
        <div
          className="text-6xl sm:text-[80px] font-extrabold leading-none my-2 bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(135deg,#7C3AED,#9333EA)' }}
        >
          404
        </div>
        <p className="text-sm sm:text-[15px] max-w-md text-[#64748B] mt-1">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-all duration-300 px-6 py-2.5 text-base font-semibold hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Go Back
          </button>
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6d28d9] transition-all duration-300 px-6 py-2.5 text-base font-semibold hover:scale-105 shadow-lg shadow-purple-500/30"
          >
            <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

// 2. Running stick figures
type StickFigure = {
  top?: string;
  bottom?: string;
  src: string;
  transform?: string;
  speedX: number;
  speedRotation?: number;
};

const STICK_BASE =
  'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks';

function CharactersAnimation() {
  const charactersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stickFigures: StickFigure[] = [
      { top: '0%', src: `${STICK_BASE}/stick0.svg`, transform: 'rotateZ(-90deg)', speedX: 1500 },
      { top: '10%', src: `${STICK_BASE}/stick1.svg`, speedX: 3000, speedRotation: 2000 },
      { top: '20%', src: `${STICK_BASE}/stick2.svg`, speedX: 5000, speedRotation: 1000 },
      { top: '25%', src: `${STICK_BASE}/stick0.svg`, speedX: 2500, speedRotation: 1500 },
      { top: '35%', src: `${STICK_BASE}/stick0.svg`, speedX: 2000, speedRotation: 300 },
      { bottom: '5%', src: `${STICK_BASE}/stick3.svg`, speedX: 0 },
    ];

    const container = charactersRef.current;
    if (container) container.innerHTML = '';

    stickFigures.forEach((figure, index) => {
      const stick = document.createElement('img');
      stick.style.position = 'absolute';
      stick.style.width = '18%';
      stick.style.height = '18%';
      if (figure.top) stick.style.top = figure.top;
      if (figure.bottom) stick.style.bottom = figure.bottom;
      stick.src = figure.src;
      if (figure.transform) stick.style.transform = figure.transform;
      container?.appendChild(stick);

      if (index === 5) return;
      stick.animate([{ left: '100%' }, { left: '-20%' }], {
        duration: figure.speedX,
        easing: 'linear',
        fill: 'forwards',
      });

      if (index === 0) return;
      if (figure.speedRotation) {
        stick.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], {
          duration: figure.speedRotation,
          iterations: Infinity,
          easing: 'linear',
        });
      }
    });

    return () => {
      if (container) container.innerHTML = '';
    };
  }, []);

  return <div ref={charactersRef} className="absolute w-[99%] h-[95%] pointer-events-none" />;
}

// 3. Expanding circle reveal (canvas)
interface Circulo {
  x: number;
  y: number;
  size: number;
}

function CircleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number>();
  const timerRef = useRef(0);
  const circulosRef = useRef<Circulo[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initArr = () => {
      circulosRef.current = [];
      for (let index = 0; index < 300; index++) {
        const randomX =
          Math.floor(Math.random() * (canvas.width * 3 - canvas.width * 1.2 + 1)) + canvas.width * 1.2;
        const randomY =
          Math.floor(Math.random() * (canvas.height - (canvas.height * -0.2 + 1))) + canvas.height * -0.2;
        const size = canvas.width / 1000;
        circulosRef.current.push({ x: randomX, y: randomY, size });
      }
    };

    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;

      timerRef.current++;
      context.setTransform(1, 0, 0, 1, 0, 0);

      const distanceX = canvas.width / 80;
      const growthRate = canvas.width / 1000;

      context.fillStyle = 'white';
      context.clearRect(0, 0, canvas.width, canvas.height);

      circulosRef.current.forEach((circulo) => {
        context.beginPath();
        if (timerRef.current < 65) {
          circulo.x = circulo.x - distanceX;
          circulo.size = circulo.size + growthRate;
        }
        if (timerRef.current > 65 && timerRef.current < 500) {
          circulo.x = circulo.x - distanceX * 0.02;
          circulo.size = circulo.size + growthRate * 0.2;
        }
        context.arc(circulo.x, circulo.y, circulo.size, 0, 360);
        context.fill();
      });

      if (timerRef.current > 500) {
        if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        return;
      }
      requestIdRef.current = requestAnimationFrame(draw);
    };

    const start = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      timerRef.current = 0;
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
      (canvas.getContext('2d') as any)?.reset?.();
      initArr();
      draw();
    };

    start();
    window.addEventListener('resize', start);
    return () => {
      window.removeEventListener('resize', start);
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
