import React, { useState, useEffect, useRef } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';

interface AdsrVisualizerProps {
  attack: number; // in seconds (e.g. 0.001 to 2.0)
  decay: number; // in seconds (e.g. 0.01 to 2.0)
  sustain: number; // normalized 0 to 1
  release: number; // in seconds (e.g. 0.01 to 3.0)
  height?: number;
  width?: number;
  showLabels?: boolean;
  className?: string;
  theme?: 'studio-retro' | 'hardware-bench' | 'diagram';
  engine?: SubtractiveEngine;
}

export const AdsrVisualizer: React.FC<AdsrVisualizerProps> = ({
  attack,
  decay,
  sustain,
  release,
  height = 180,
  width = 380,
  showLabels = true,
  className = '',
  theme = 'diagram',
  engine,
}) => {
  // SVG Dimensions & Margins
  const svgWidth = 400;
  const svgHeight = 200;

  const paddingLeft = 36;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 34;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Clamped proportional widths for the 4 zones
  const rawA = Math.max(0.005, Math.min(2.0, attack));
  const rawD = Math.max(0.01, Math.min(2.0, decay));
  const rawS = Math.max(0.0, Math.min(1.0, sustain));
  const rawR = Math.max(0.01, Math.min(3.0, release));

  // Map to visual proportional fractions
  const minW = 22;
  const weightA = Math.pow(rawA, 0.5);
  const weightD = Math.pow(rawD, 0.5);
  const weightS = 1.35; // Fixed reasonable sustain plateau width for representation
  const weightR = Math.pow(rawR, 0.5);

  const totalWeight = weightA + weightD + weightS + weightR;
  const widthA = Math.max(minW, (weightA / totalWeight) * plotWidth);
  const widthD = Math.max(minW, (weightD / totalWeight) * plotWidth);
  const widthR = Math.max(minW, (weightR / totalWeight) * plotWidth);
  const widthS = plotWidth - widthA - widthD - widthR;

  // X Coordinates of zone boundaries
  const x0 = paddingLeft;
  const xA = x0 + widthA;
  const xD = xA + widthD;
  const xS = xD + widthS;
  const xR = xS + widthR;

  // Y Coordinates
  const yPeak = paddingTop;
  const yZero = paddingTop + plotHeight;
  const ySustain = yZero - rawS * plotHeight;
  const yTop15 = yZero - 0.85 * plotHeight; // Threshold for the top 15%

  // SVG Path for the ADSR curve:
  // Attack: linear or slight ease from (x0, yZero) to (xA, yPeak)
  // Decay: curve from (xA, yPeak) to (xD, ySustain)
  // Sustain: flat horizontal line from (xD, ySustain) to (xS, ySustain)
  // Release: curve from (xS, ySustain) to (xR, yZero)
  const curvePath = `
    M ${x0} ${yZero}
    L ${xA} ${yPeak}
    C ${xA + widthD * 0.35} ${yPeak + (ySustain - yPeak) * 0.75}, ${xA + widthD * 0.7} ${ySustain}, ${xD} ${ySustain}
    L ${xS} ${ySustain}
    C ${xS + widthR * 0.35} ${ySustain + (yZero - ySustain) * 0.65}, ${xS + widthR * 0.7} ${yZero}, ${xR} ${yZero}
  `;

  // Filled area under the curve
  const areaPath = `
    M ${x0} ${yZero}
    L ${xA} ${yPeak}
    C ${xA + widthD * 0.35} ${yPeak + (ySustain - yPeak) * 0.75}, ${xA + widthD * 0.7} ${ySustain}, ${xD} ${ySustain}
    L ${xS} ${ySustain}
    C ${xS + widthR * 0.35} ${ySustain + (yZero - ySustain) * 0.65}, ${xS + widthR * 0.7} ${yZero}, ${xR} ${yZero}
    L ${x0} ${yZero}
    Z
  `;

  // Real-time animation dot state tracking the envelope motion when played
  const [dot, setDot] = useState<{
    active: boolean;
    x: number;
    y: number;
    level: number;
    stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  }>({
    active: false,
    x: x0,
    y: yZero,
    level: 0,
    stage: 'idle',
  });

  const isHeldRef = useRef(false);
  const pressTimeRef = useRef<number | null>(null);
  const releaseTimeRef = useRef<number | null>(null);
  const releaseLevelRef = useRef(0);
  const currentLevelRef = useRef(0);
  const animIdRef = useRef<number | null>(null);

  // Helper to start the animation loop
  const runAnimLoop = () => {
    if (animIdRef.current !== null) return;

    const tick = () => {
      const now = performance.now();
      const isHeld = isHeldRef.current;
      const pressTime = pressTimeRef.current;
      const releaseTime = releaseTimeRef.current;

      const aSec = Math.max(0.005, rawA);
      const dSec = Math.max(0.01, rawD);
      const sLvl = rawS;
      const rSec = Math.max(0.01, rawR);

      let currentX = x0;
      let currentY = yZero;
      let currentLevel = 0;
      let stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
      let keepGoing = false;

      if (isHeld && pressTime !== null) {
        const elapsedSec = (now - pressTime) / 1000;
        keepGoing = true;

        if (elapsedSec < aSec) {
          // Attack stage (0 to aSec)
          const p = Math.min(1.0, elapsedSec / aSec);
          currentX = x0 + p * (xA - x0);
          currentY = yZero - p * (yZero - yPeak);
          currentLevel = p;
          stage = 'attack';
        } else if (elapsedSec < aSec + dSec) {
          // Decay stage (aSec to aSec + dSec)
          const p = Math.min(1.0, (elapsedSec - aSec) / dSec);
          currentX = xA + p * (xD - xA);
          // Ease down towards sustain
          const easeP = 1 - Math.pow(1 - p, 2);
          currentY = yPeak + (ySustain - yPeak) * easeP;
          currentLevel = 1.0 - (1.0 - sLvl) * p;
          stage = 'decay';
        } else {
          // Sustain stage: hold on the plateau
          const sustainElapsed = elapsedSec - aSec - dSec;
          // Progress gently along the sustain plateau
          const sustainProgress = Math.min(1.0, sustainElapsed / 2.0);
          currentX = xD + sustainProgress * (xS - xD) * 0.85;
          currentY = ySustain;
          currentLevel = sLvl;
          stage = 'sustain';
        }
        currentLevelRef.current = currentLevel;
      } else if (!isHeld && releaseTime !== null) {
        // Release stage: falling from releaseLevel to 0
        const relElapsed = (now - releaseTime) / 1000;
        const startLevel = releaseLevelRef.current;

        if (relElapsed < rSec && startLevel > 0.001) {
          keepGoing = true;
          const p = Math.min(1.0, relElapsed / rSec);
          currentX = xS + p * (xR - xS);
          const easeP = 1 - Math.pow(1 - p, 2);
          currentY = ySustain + (yZero - ySustain) * easeP;
          currentLevel = Math.max(0, startLevel * (1.0 - p));
          stage = 'release';
          currentLevelRef.current = currentLevel;
        } else {
          // Finished
          keepGoing = false;
          currentX = xR;
          currentY = yZero;
          currentLevel = 0;
          stage = 'idle';
          currentLevelRef.current = 0;
        }
      }

      setDot({
        active: keepGoing || isHeld,
        x: currentX,
        y: currentY,
        level: currentLevel,
        stage,
      });

      if (keepGoing || isHeld) {
        animIdRef.current = requestAnimationFrame(tick);
      } else {
        animIdRef.current = null;
      }
    };

    animIdRef.current = requestAnimationFrame(tick);
  };

  // Subscribe to engine notes / envelope
  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.subscribeEnvelope((isHeld) => {
      const now = performance.now();
      if (isHeld) {
        isHeldRef.current = true;
        pressTimeRef.current = now;
        releaseTimeRef.current = null;
        runAnimLoop();
      } else {
        isHeldRef.current = false;
        releaseTimeRef.current = now;
        releaseLevelRef.current = currentLevelRef.current;
        runAnimLoop();
      }
    });

    return () => {
      unsubscribe();
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [engine, rawA, rawD, rawS, rawR]);

  // Handle clicking on the diagram to test / audition the envelope
  const handleAuditionClick = () => {
    if (engine) {
      engine.noteOn('C4', 0.85);
      setTimeout(() => {
        engine.noteOff('C4');
      }, 750);
    }
  };

  const isPeak = dot.level >= 0.85;

  return (
    <div
      id="adsr-diagram-container"
      className={`relative rounded-xl overflow-hidden select-none border transition-all ${
        theme === 'hardware-bench'
          ? 'bg-[#181d22] border-[#374151]'
          : theme === 'studio-retro'
          ? 'bg-[#0e1117] border-amber-500/30'
          : 'bg-[#fcfdfa] border-slate-300 shadow-md'
      } ${className}`}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto block cursor-pointer"
        style={{ maxHeight: `${height}px` }}
        onClick={handleAuditionClick}
        title="Click to audition ADSR Envelope with moving dot"
      >
        <defs>
          {/* Arrow markers for axes */}
          <marker
            id="axis-arrow-y"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 10 L 5 0 L 10 10 z" fill="#0f172a" />
          </marker>
          <marker
            id="axis-arrow-x"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
          </marker>
          <marker
            id="sustain-arrow-top"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 10 L 5 0 L 10 10 z" fill="#0284c7" />
          </marker>

          {/* Vertical Linear Gradient for ADSR Curve: Bottom to 85% is normal, Top 15% (85% to 100%) fades into RED */}
          <linearGradient id="adsr-curve-stroke" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0f172a'} />
            <stop offset="85%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0f172a'} />
            <stop offset="92%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          {/* Area gradient under curve */}
          <linearGradient id="adsr-area-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0284c7'} stopOpacity="0.04" />
            <stop offset="85%" stopColor={theme === 'studio-retro' ? '#f59e0b' : '#0284c7'} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.32" />
          </linearGradient>
        </defs>

        {/* 1. FOUR COLORED VERTICAL BACKGROUND BANDS (Modelled on reference image) */}
        {/* Attack Band: Light Green */}
        <rect
          x={x0}
          y={paddingTop - 10}
          width={widthA}
          height={plotHeight + 10}
          fill="#a7f3d0"
          fillOpacity={theme === 'diagram' ? '0.85' : '0.18'}
        />

        {/* Decay Band: Light Orange */}
        <rect
          x={xA}
          y={paddingTop - 10}
          width={widthD}
          height={plotHeight + 10}
          fill="#fed7aa"
          fillOpacity={theme === 'diagram' ? '0.85' : '0.18'}
        />

        {/* Sustain Band: Light Blue */}
        <rect
          x={xD}
          y={paddingTop - 10}
          width={widthS}
          height={plotHeight + 10}
          fill="#bae6fd"
          fillOpacity={theme === 'diagram' ? '0.85' : '0.18'}
        />

        {/* Release Band: Light Pink / Magenta */}
        <rect
          x={xS}
          y={paddingTop - 10}
          width={widthR}
          height={plotHeight + 10}
          fill="#fbcfe8"
          fillOpacity={theme === 'diagram' ? '0.85' : '0.18'}
        />

        {/* Top 15% Peak Zone Highlight Band */}
        <rect
          x={x0}
          y={yPeak}
          width={plotWidth}
          height={yTop15 - yPeak}
          fill="#ef4444"
          fillOpacity={theme === 'diagram' ? '0.08' : '0.12'}
          stroke="#ef4444"
          strokeWidth="0.75"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
        />
        {/* Top 15% Tag */}
        <text
          x={xR - 6}
          y={yPeak + 10}
          textAnchor="end"
          fontSize="8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill="#dc2626"
          opacity="0.9"
        >
          TOP 15% PEAK (RED ZONE)
        </text>

        {/* 2. VERTICAL DASHED DIVIDING LINES */}
        {/* Attack to Decay boundary (from peak down) */}
        <line
          x1={xA}
          y1={yPeak}
          x2={xA}
          y2={yZero}
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeOpacity="0.7"
        />

        {/* Decay to Sustain boundary */}
        <line
          x1={xD}
          y1={ySustain}
          x2={xD}
          y2={yZero}
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeOpacity="0.7"
        />

        {/* Sustain to Release boundary */}
        <line
          x1={xS}
          y1={ySustain}
          x2={xS}
          y2={yZero}
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeOpacity="0.7"
        />

        {/* 3. SUSTAIN LEVEL INDICATOR ARROW & TEXT */}
        {rawS > 0.08 && (
          <g>
            <line
              x1={xD + widthS / 2}
              y1={yZero}
              x2={xD + widthS / 2}
              y2={ySustain + 4}
              stroke="#0369a1"
              strokeWidth="2"
              markerEnd="url(#sustain-arrow-top)"
            />
          </g>
        )}

        {/* Sustain Text Label inside Sustain zone */}
        <text
          x={xD + widthS / 2}
          y={ySustain + (yZero - ySustain) / 2 + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#0c4a6e"
          style={{ textShadow: '0 0 4px rgba(255,255,255,0.8)' }}
        >
          Sustain
        </text>

        {/* Shaded Area Under Curve */}
        <path d={areaPath} fill="url(#adsr-area-gradient)" />

        {/* 4. SOLID ADSR ENVELOPE CURVE (with top 15% fading into red) */}
        <path
          d={curvePath}
          fill="none"
          stroke="url(#adsr-curve-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 5. X AND Y AXES WITH ARROWS */}
        {/* Y Axis (Level) */}
        <line
          x1={x0}
          y1={yZero}
          x2={x0}
          y2={paddingTop - 14}
          stroke="#0f172a"
          strokeWidth="2"
          markerEnd="url(#axis-arrow-y)"
        />
        {/* Level 100% Text Label along Y Axis */}
        <text
          x={x0 - 8}
          y={paddingTop + 45}
          textAnchor="middle"
          transform={`rotate(-90 ${x0 - 8} ${paddingTop + 45})`}
          fontSize="13"
          fontStyle="italic"
          fontWeight="500"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#0f172a"
        >
          Level 100%
        </text>

        {/* X Axis (Time) */}
        <line
          x1={x0}
          y1={yZero}
          x2={svgWidth - 6}
          y2={yZero}
          stroke="#0f172a"
          strokeWidth="2"
          markerEnd="url(#axis-arrow-x)"
        />
        {/* Time Text Label along X Axis */}
        <text
          x={svgWidth - 14}
          y={yZero + 18}
          textAnchor="end"
          fontSize="13"
          fontStyle="italic"
          fontWeight="500"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#0f172a"
        >
          Time
        </text>

        {/* 6. ZONE LABELS AT THE BOTTOM */}
        {showLabels && (
          <g fontSize="12" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">
            {/* Attack Label */}
            <text x={x0 + widthA / 2} y={yZero + 16} textAnchor="middle" fill="#065f46">
              Attack
            </text>
            <text x={x0 + widthA / 2} y={yZero + 28} textAnchor="middle" fontSize="9" fill="#047857" opacity="0.85">
              {rawA >= 1 ? `${rawA.toFixed(2)}s` : `${Math.round(rawA * 1000)}ms`}
            </text>

            {/* Decay Label */}
            <text x={xA + widthD / 2} y={yZero + 16} textAnchor="middle" fill="#9a3412">
              Decay
            </text>
            <text x={xA + widthD / 2} y={yZero + 28} textAnchor="middle" fontSize="9" fill="#c2410c" opacity="0.85">
              {rawD >= 1 ? `${rawD.toFixed(2)}s` : `${Math.round(rawD * 1000)}ms`}
            </text>

            {/* Release Label */}
            <text x={xS + widthR / 2} y={yZero + 16} textAnchor="middle" fill="#831843">
              Release
            </text>
            <text x={xS + widthR / 2} y={yZero + 28} textAnchor="middle" fontSize="9" fill="#9d174d" opacity="0.85">
              {rawR >= 1 ? `${rawR.toFixed(2)}s` : `${Math.round(rawR * 1000)}ms`}
            </text>
          </g>
        )}

        {/* 7. ANIMATED ENVELOPE TRACKING DOT (Follows envelope motion in real-time) */}
        {dot.active && (
          <g className="transition-all duration-75">
            {/* Pulsing ring aura */}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={isPeak ? 13 : 9}
              fill="none"
              stroke={isPeak ? '#ef4444' : theme === 'diagram' ? '#0284c7' : '#f59e0b'}
              strokeWidth="2.5"
              className="animate-ping opacity-75"
            />
            {/* Glow backing */}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={isPeak ? 9 : 7}
              fill={isPeak ? '#ef4444' : theme === 'diagram' ? '#0284c7' : '#f59e0b'}
              opacity="0.45"
            />
            {/* Center solid luminous dot */}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={isPeak ? 6.5 : 5.5}
              fill={isPeak ? '#dc2626' : theme === 'diagram' ? '#0284c7' : '#fbbf24'}
              stroke="#ffffff"
              strokeWidth="2"
              style={{
                filter: isPeak ? 'drop-shadow(0 0 8px #ef4444)' : 'drop-shadow(0 0 5px #0284c7)',
              }}
            />

            {/* Floating Live Tag displaying Stage and Amplitude */}
            <g transform={`translate(${Math.min(svgWidth - 70, Math.max(x0, dot.x - 30))}, ${Math.max(12, dot.y - 17)})`}>
              <rect
                x="0"
                y="0"
                width="60"
                height="15"
                rx="3.5"
                fill={isPeak ? '#991b1b' : '#0f172a'}
                opacity="0.92"
                stroke={isPeak ? '#f87171' : '#38bdf8'}
                strokeWidth="1"
              />
              <text
                x="30"
                y="11"
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#ffffff"
              >
                {dot.stage.toUpperCase()} {Math.round(dot.level * 100)}%
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
