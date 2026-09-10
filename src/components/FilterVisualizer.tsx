import React, { useEffect, useRef } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode, SynthParams } from '../types';

interface FilterVisualizerProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  height?: number;
}

export const FilterVisualizer: React.FC<FilterVisualizerProps> = ({ engine, theme, height = 130 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;

      // Clear background with OLED aesthetic
      ctx.fillStyle = theme === 'hardware-bench' ? '#060a08' : '#050807';
      ctx.fillRect(0, 0, width, h);

      const params: SynthParams = engine.getParams();
      const cutoff = params.filterCutoff; // 20 - 20000
      const Q = params.filterResonance; // 0.1 - 20
      const rolloff = params.filterRolloff; // -12 or -24

      const minFreq = 20;
      const maxFreq = 20000;
      const freqToX = (f: number) => {
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const fLog = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
        return ((fLog - minLog) / (maxLog - minLog)) * width;
      };

      // Draw grid lines for frequency
      const gridFreqs = [100, 1000, 10000];
      ctx.strokeStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)';
      ctx.lineWidth = 1;
      ctx.fillStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(245, 158, 11, 0.6)';
      ctx.font = '9px monospace';

      gridFreqs.forEach((freq) => {
        const x = freqToX(freq);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - 22);
        ctx.stroke();
        ctx.fillText(freq >= 1000 ? `${freq / 1000}k` : `${freq}`, x + 2, h - 26);
      });

      // Draw Filter Response Curve (Logic Pro Retro Synth style)
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
      ctx.shadowColor = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
      ctx.shadowBlur = 8;

      let filterStarted = false;
      let peakX = 0;
      let peakY = 0;
      let peakGain = -999;

      for (let x = 0; x <= width; x += 1) {
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        const fLog = minLog + (x / width) * (maxLog - minLog);
        const freq = Math.pow(10, fLog);

        const w = freq / Math.max(20, cutoff);
        const poles = rolloff === -24 ? 2 : 1;
        
        const denom = Math.sqrt(Math.pow(1 - w * w, poles) + Math.pow(w / Q, 2));
        let gain = 1 / Math.max(0.01, denom);
        
        if (Q > 0.5 && Math.abs(freq - cutoff) < cutoff * 0.28) {
          gain *= (1 + (Q * 0.22));
        }

        const dbGain = 20 * Math.log10(Math.max(0.01, gain));
        const normalizedGain = Math.max(0, Math.min(1, (dbGain + 12) / 36));
        const y = (h - 26) - (normalizedGain * (h - 45));

        if (dbGain > peakGain) {
          peakGain = dbGain;
          peakX = x;
          peakY = y;
        }

        if (!filterStarted) {
          ctx.moveTo(x, y);
          filterStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw resonance peak dot (Logic Pro Retro Synth style)
      if (peakX > 0 && peakY > 0) {
        ctx.beginPath();
        ctx.arc(peakX, peakY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'hardware-bench' ? '#22c55e' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bottom Readout bar (Logic Pro Retro Synth style: Cutoff & Res)
      ctx.fillStyle = theme === 'hardware-bench' ? '#040705' : '#040705';
      ctx.fillRect(0, h - 22, width, 22);
      ctx.strokeStyle = theme === 'hardware-bench' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, h - 22);
      ctx.lineTo(width, h - 22);
      ctx.stroke();

      ctx.fillStyle = theme === 'hardware-bench' ? '#4ade80' : '#fbbf24';
      ctx.font = '11px monospace';
      const cutoffVal = params.filterCutoff >= 1000 ? (params.filterCutoff / 1000).toFixed(2) + ' kHz' : Math.round(params.filterCutoff) + ' Hz';
      ctx.fillText(`Cutoff: ${cutoffVal}`, 12, h - 7);
      ctx.fillText(`Res: ${params.filterResonance.toFixed(2)}`, width - 95, h - 7);

      // CRT Scanline Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, width, 1);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [engine, theme]);

  return (
    <div
      id="filter-visualizer-card"
      className={`relative rounded-lg overflow-hidden border shadow-inner mb-3 transition-all ${
        theme === 'hardware-bench'
          ? 'bg-[#060a08] border-[#1f2923] shadow-black/80'
          : 'bg-[#050807] border-[#18231d] shadow-black/80'
      }`}
    >
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
        <span className="text-[11px] uppercase font-mono tracking-widest text-amber-300/95 font-bold">
          VCF FILTER RESPONSE
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={640}
        height={height}
        className="w-full block"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
