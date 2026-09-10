import React from 'react';
import { ThemeMode } from '../types';

interface ToggleSwitchProps<T> {
  id: string;
  label: string;
  options: { label: string; value: T; short?: string }[];
  value: T;
  theme: ThemeMode;
  orientation?: 'vertical' | 'horizontal';
  onChange: (val: T) => void;
}

export function ToggleSwitch<T extends string | number>({
  id,
  label,
  options,
  value,
  theme,
  orientation = 'vertical',
  onChange,
}: ToggleSwitchProps<T>) {
  const currentIndex = options.findIndex((opt) => opt.value === value);

  const cycleNext = () => {
    const nextIdx = (currentIndex + 1) % options.length;
    onChange(options[nextIdx].value);
  };

  return (
    <div id={id} className="flex flex-col items-center select-none">
      {label && (
        <span
          className={`text-[10px] font-semibold tracking-wider uppercase mb-1.5 transition-colors ${
            theme === 'hardware-bench'
              ? 'text-slate-800 font-sans'
              : 'text-amber-100/90 font-mono text-[9px]'
          }`}
        >
          {label}
        </span>
      )}

      {/* Hardware Lever Switch UI */}
      <div
        onClick={cycleNext}
        className={`relative flex items-center justify-between p-1 rounded cursor-pointer transition-all border ${
          orientation === 'vertical' ? 'flex-col gap-1 w-8 py-2' : 'flex-row gap-1 px-2 py-1'
        } ${
          theme === 'hardware-bench'
            ? 'bg-gradient-to-b from-[#d8dce2] to-[#b4bac4] border-[#8a929f] shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
            : 'bg-gradient-to-b from-[#2a2e36] to-[#16181d] border-[#3f4754] shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
        }`}
        title="Click to cycle position"
      >
        {options.map((opt, idx) => {
          const isActive = opt.value === value;
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
              }}
              className={`text-[9px] font-mono uppercase px-1 py-0.5 rounded transition-all ${
                isActive
                  ? theme === 'hardware-bench'
                    ? 'bg-slate-900 text-amber-300 font-bold shadow-sm'
                    : 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : theme === 'hardware-bench'
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.short || opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
