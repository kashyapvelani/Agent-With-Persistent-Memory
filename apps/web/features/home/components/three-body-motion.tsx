'use client';

import { useEffect, useRef } from "react";

const TWO_PI = Math.PI * 2;
const DEFAULT_TRAIL_LENGTH = 320;
const DEFAULT_SPEED_STEP = 0.005;

type Point = {
  x: number;
  y: number;
};

type PointConfig = {
  xSinAmp: number;
  xSinFreq: number;
  xCosAmp: number;
  xCosFreq: number;
  yCosAmp: number;
  yCosFreq: number;
  ySinAmp: number;
  ySinFreq: number;
  xPhase?: number;
  yPhase?: number;
};

type ThreeBodyMotionProps = {
  className?: string;
  trailLength?: number;
  speedStep?: number;
};

const POINT_CONFIGS: readonly [PointConfig, PointConfig, PointConfig] = [
  { xSinAmp: 0.35, xSinFreq: 1.1, xCosAmp: 0.18, xCosFreq: 2.7, yCosAmp: 0.3, yCosFreq: 1.6, ySinAmp: 0.22, ySinFreq: 2.1 },
  { xSinAmp: 0.4, xSinFreq: 1.4, xCosAmp: 0.15, xCosFreq: 2.9, yCosAmp: 0.32, yCosFreq: 1.2, ySinAmp: 0.2, ySinFreq: 2.6, xPhase: 2, yPhase: 1 },
  { xSinAmp: 0.38, xSinFreq: 1.7, xCosAmp: 0.2, xCosFreq: 2.3, yCosAmp: 0.28, yCosFreq: 1.3, ySinAmp: 0.17, ySinFreq: 2.8, xPhase: 4, yPhase: 3 },
];

function getPositions(t: number, width: number, height: number): [Point, Point, Point] {
  const scale = Math.min(width, height) * 0.38;
  const cx = width / 2;
  const cy = height / 2;

  return POINT_CONFIGS.map((config) => ({
    x: cx + scale * (config.xSinAmp * Math.sin(config.xSinFreq * t + (config.xPhase ?? 0)) + config.xCosAmp * Math.cos(config.xCosFreq * t)),
    y: cy + scale * (config.yCosAmp * Math.cos(config.yCosFreq * t + (config.yPhase ?? 0)) + config.ySinAmp * Math.sin(config.ySinFreq * t)),
  })) as [Point, Point, Point];
}

export default function ThreeBodyMotion({
  className,
  trailLength = DEFAULT_TRAIL_LENGTH,
  speedStep = DEFAULT_SPEED_STEP,
}: ThreeBodyMotionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const trailsRef = useRef<[Point[], Point[], Point[]]>([[], [], []]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      timeRef.current += speedStep;
      const t = timeRef.current;
      const { width, height } = canvas;
      const dotR = height * 0.008;

      ctx.clearRect(0, 0, width, height);

      const points = getPositions(t, width, height);

      points.forEach((point, index) => {
        const trail = trailsRef.current[index];
        if (!trail) return;
        trail.push({ x: point.x, y: point.y });
        if (trail.length > trailLength) {
          trail.shift();
        }
      });

      for (let i = 0; i < trailsRef.current.length; i++) {
        const trail = trailsRef.current[i];
        const currentPoint = points[i];
        if (!trail || !currentPoint || trail.length < 2) continue;

        for (let j = 1; j < trail.length; j++) {
          const previous = trail[j - 1];
          const current = trail[j];
          if (!previous || !current) continue;
          if (Math.hypot(current.x - currentPoint.x, current.y - currentPoint.y) < dotR) continue;

          const age = j / trail.length;
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(current.x, current.y);
          ctx.strokeStyle = `rgba(255,255,255,${age * 0.45})`;
          ctx.lineWidth = 0.4 + age * 1.2;
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = "exclusion";
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, dotR, 0, TWO_PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
      });
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener("resize", resize);
    };
  }, [speedStep, trailLength]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
