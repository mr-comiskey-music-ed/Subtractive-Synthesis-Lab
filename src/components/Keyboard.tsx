import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SubtractiveEngine } from '../audio/synthEngine';
import { ThemeMode, SynthParams } from '../types';

interface KeyboardProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  params?: SynthParams;
  octaveOffset?: number;
  onOctaveChange?: (oct: number) => void;
}

interface KeyDef {
  note: string;
  isBlack: boolean;
  pcKey?: string;
  label: string;
}

interface NoteEnvelopeState {
  pressTime: number;
  releaseTime: number | null;
  releaseLevel: number;
  currentLevel: number;
}

export const Keyboard: React.FC<KeyboardProps> = ({
  engine,
  theme,
  params,
  octaveOffset = 3,
  onOctaveChange,
}) => {
  const [octave, setOctave] = useState<number>(octaveOffset);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [midiStatus, setMidiStatus] = useState<string>('Detecting MIDI...');
  const [keyLevels, setKeyLevels] = useState<Record<string, number>>({});
  const isMouseDownRef = useRef(false);

  // Map to track the ADSR envelope state per note in real-time
  const envelopeMapRef = useRef<Map<string, NoteEnvelopeState>>(new Map());
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize MIDI on mount
  useEffect(() => {
    engine.setupMidi((status) => setMidiStatus(status));
  }, [engine]);

  // Sync active notes with the engine
  useEffect(() => {
    engine.onActiveNotesChange = (notes) => {
      setActiveNotes(new Set(notes));
    };
  }, [engine]);

  // Track key press/release transitions to drive envelope animations
  useEffect(() => {
    const now = performance.now();
    const envMap = envelopeMapRef.current;

    // Detect newly pressed notes
    activeNotes.forEach((note) => {
      if (!envMap.has(note) || envMap.get(note)!.releaseTime !== null) {
        const existing = envMap.get(note);
        envMap.set(note, {
          pressTime: now,
          releaseTime: null,
          releaseLevel: existing ? existing.currentLevel : 0,
          currentLevel: existing ? existing.currentLevel : 0,
        });
      }
    });

    // Detect newly released notes
    envMap.forEach((state, note) => {
      if (!activeNotes.has(note) && state.releaseTime === null) {
        state.releaseTime = now;
        state.releaseLevel = state.currentLevel;
      }
    });
  }, [activeNotes]);

  // Real-time animation loop computing the Amp Envelope amplitude curve for all active keys
  useEffect(() => {
    let isCancelled = false;

    const tick = () => {
      if (isCancelled) return;
      const now = performance.now();
      const envMap = envelopeMapRef.current;

      const attack = Math.max(0.005, params?.ampAttack ?? 0.01);
      const decay = Math.max(0.01, params?.ampDecay ?? 0.3);
      const sustain = Math.max(0, Math.min(1, params?.ampSustain ?? 0.7));
      const release = Math.max(0.01, params?.ampRelease ?? 0.2);

      const nextLevels: Record<string, number> = {};
      let hasRunningNotes = false;

      envMap.forEach((state, note) => {
        if (state.releaseTime === null) {
          // Key is held down: Attack -> Decay -> Sustain
          const elapsedSec = (now - state.pressTime) / 1000;
          if (elapsedSec < attack) {
            // Attack stage: rising smoothly to 1.0
            state.currentLevel = Math.min(1.0, elapsedSec / attack);
          } else if (elapsedSec < attack + decay) {
            // Decay stage: falling from 1.0 to sustain
            const p = (elapsedSec - attack) / decay;
            state.currentLevel = Math.max(sustain, 1.0 - (1.0 - sustain) * p);
          } else {
            // Sustain stage: holding steady
            state.currentLevel = sustain;
          }
          nextLevels[note] = state.currentLevel;
          hasRunningNotes = true;
        } else {
          // Key was released: falling from releaseLevel to 0
          const relElapsedSec = (now - state.releaseTime) / 1000;
          if (relElapsedSec < release) {
            const p = relElapsedSec / release;
            state.currentLevel = Math.max(0, state.releaseLevel * (1.0 - p));
            nextLevels[note] = state.currentLevel;
            hasRunningNotes = true;
          } else {
            state.currentLevel = 0;
            envMap.delete(note);
          }
        }
      });

      setKeyLevels(nextLevels);

      // Continue loop if keys are active or held
      if (hasRunningNotes || activeNotes.size > 0) {
        animFrameIdRef.current = requestAnimationFrame(tick);
      } else {
        animFrameIdRef.current = null;
      }
    };

    if (activeNotes.size > 0 || envelopeMapRef.current.size > 0) {
      if (!animFrameIdRef.current) {
        animFrameIdRef.current = requestAnimationFrame(tick);
      }
    }

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [activeNotes, params?.ampAttack, params?.ampDecay, params?.ampSustain, params?.ampRelease]);

  const handleOctaveShift = useCallback(
    (delta: number) => {
      const newOct = Math.max(1, Math.min(6, octave + delta));
      setOctave(newOct);
      if (onOctaveChange) onOctaveChange(newOct);
    },
    [octave, onOctaveChange]
  );

  // Key map for computer keyboard
  // Row 1: A W S E D F T G Y H U J K O L P
  const keyToNoteMap = useCallback(
    (key: string): string | null => {
      const mapping: Record<string, { note: string; octShift: number }> = {
        a: { note: 'C', octShift: 0 },
        w: { note: 'C#', octShift: 0 },
        s: { note: 'D', octShift: 0 },
        e: { note: 'D#', octShift: 0 },
        d: { note: 'E', octShift: 0 },
        f: { note: 'F', octShift: 0 },
        t: { note: 'F#', octShift: 0 },
        g: { note: 'G', octShift: 0 },
        y: { note: 'G#', octShift: 0 },
        h: { note: 'A', octShift: 0 },
        u: { note: 'A#', octShift: 0 },
        j: { note: 'B', octShift: 0 },
        k: { note: 'C', octShift: 1 },
        o: { note: 'C#', octShift: 1 },
        l: { note: 'D', octShift: 1 },
        p: { note: 'D#', octShift: 1 },
        ';': { note: 'E', octShift: 1 },
      };

      const match = mapping[key.toLowerCase()];
      if (match) {
        return `${match.note}${octave + match.octShift}`;
      }
      return null;
    },
    [octave]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key.toLowerCase() === 'z') {
        handleOctaveShift(-1);
        return;
      }
      if (e.key.toLowerCase() === 'x') {
        handleOctaveShift(1);
        return;
      }

      if (e.repeat) return;
      const note = keyToNoteMap(e.key);
      if (note && !activeNotes.has(note)) {
        engine.noteOn(note);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const note = keyToNoteMap(e.key);
      if (note) {
        engine.noteOff(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine, keyToNoteMap, handleOctaveShift, activeNotes]);

  // Generate 2 octaves of keys starting at current octave
  const generateKeys = (): KeyDef[] => {
    const baseOct = octave;
    const structure: { n: string; isBlack: boolean; key?: string }[] = [
      { n: 'C', isBlack: false, key: 'A' },
      { n: 'C#', isBlack: true, key: 'W' },
      { n: 'D', isBlack: false, key: 'S' },
      { n: 'D#', isBlack: true, key: 'E' },
      { n: 'E', isBlack: false, key: 'D' },
      { n: 'F', isBlack: false, key: 'F' },
      { n: 'F#', isBlack: true, key: 'T' },
      { n: 'G', isBlack: false, key: 'G' },
      { n: 'G#', isBlack: true, key: 'Y' },
      { n: 'A', isBlack: false, key: 'H' },
      { n: 'A#', isBlack: true, key: 'U' },
      { n: 'B', isBlack: false, key: 'J' },

      { n: 'C', isBlack: false, key: 'K' },
      { n: 'C#', isBlack: true, key: 'O' },
      { n: 'D', isBlack: false, key: 'L' },
      { n: 'D#', isBlack: true, key: 'P' },
      { n: 'E', isBlack: false, key: ';' },
      { n: 'F', isBlack: false },
      { n: 'F#', isBlack: true },
      { n: 'G', isBlack: false },
      { n: 'G#', isBlack: true },
      { n: 'A', isBlack: false },
      { n: 'A#', isBlack: true },
      { n: 'B', isBlack: false },
      { n: 'C', isBlack: false },
    ];

    return structure.map((item, idx) => {
      const oct = idx < 12 ? baseOct : idx < 24 ? baseOct + 1 : baseOct + 2;
      const fullNote = `${item.n}${oct}`;
      return {
        note: fullNote,
        isBlack: item.isBlack,
        pcKey: item.key,
        label: `${item.n}${oct}`,
      };
    });
  };

  const keys = generateKeys();

  const handleKeyTrigger = (note: string) => {
    engine.noteOn(note);
  };

  const handleKeyRelease = (note: string) => {
    engine.noteOff(note);
  };

  return (
    <div
      id="synth-keyboard-dock"
      className={`relative p-3 rounded-xl border select-none transition-all shadow-xl ${
        theme === 'hardware-bench'
          ? 'bg-[#181d22] border-[#2d3640]'
          : 'bg-[#121418] border-[#222730]'
      }`}
      onMouseUp={() => {
        isMouseDownRef.current = false;
      }}
      onMouseLeave={() => {
        isMouseDownRef.current = false;
        engine.allNotesOff();
      }}
    >
      {/* Keyboard Header / Controls */}
      <div className="flex items-center justify-between mb-2 px-1 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300">
            KEYBOARD CONTROLLER
          </span>

          {/* Octave Controls */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10 font-mono text-xs">
            <span className="text-slate-400 text-[10px] uppercase mr-1">Octave:</span>
            <button
              type="button"
              onClick={() => handleOctaveShift(-1)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold"
              title="Key: Z"
            >
              -
            </button>
            <span className="w-5 text-center font-bold text-amber-400">{octave}</span>
            <button
              type="button"
              onClick={() => handleOctaveShift(1)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold"
              title="Key: X"
            >
              +
            </button>
            <span className="text-[9px] text-slate-500 ml-1">(Z / X)</span>
          </div>

          <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono">
            Type with: <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">A-W-S-E-D-F...</kbd>
          </span>
        </div>

        {/* MIDI Device Detection & ADSR Status */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] text-amber-300 bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Amp EG Glow: <strong className="text-amber-300">Yellow/Gold</strong> &rarr; Top 15%: <strong className="text-red-400 font-bold">Red Peak</strong></span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            <span className="font-mono text-[10px] text-slate-300">
              {midiStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Main Piano Roll Container */}
      <div className="relative flex items-stretch h-36 sm:h-44 w-full bg-black/60 rounded-lg p-1 border border-black/80 overflow-hidden shadow-inner">
        {/* White and Black Keys rendered in order */}
        {keys.map((k) => {
          const isActive = activeNotes.has(k.note);
          const envLevel = keyLevels[k.note] !== undefined ? keyLevels[k.note] : (isActive ? 1 : 0);
          const isTop15 = envLevel >= 0.85;
          const redMix = Math.max(0, Math.min(1, (envLevel - 0.85) / 0.15));

          if (!k.isBlack) {
            return (
              <div
                key={k.note}
                data-note={k.note}
                onMouseDown={() => {
                  isMouseDownRef.current = true;
                  handleKeyTrigger(k.note);
                }}
                onMouseUp={() => handleKeyRelease(k.note)}
                onMouseEnter={() => {
                  if (isMouseDownRef.current) handleKeyTrigger(k.note);
                }}
                onMouseLeave={() => {
                  if (isMouseDownRef.current) handleKeyRelease(k.note);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleKeyTrigger(k.note);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleKeyRelease(k.note);
                }}
                className={`relative flex-1 flex flex-col justify-end items-center pb-2 cursor-pointer rounded-b transition-all border-r border-slate-400/40 select-none overflow-hidden ${
                  isActive
                    ? isTop15
                      ? 'bg-red-200 text-black'
                      : 'bg-amber-100 text-black'
                    : 'bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 hover:bg-[#e2e8f0]'
                }`}
              >
                {/* Real-time Amp Envelope Highlight Overlay with Red Fade at top 15% */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-b transition-all duration-75"
                  style={{
                    opacity: envLevel > 0.005 ? 1 : 0,
                    background:
                      redMix > 0
                        ? `linear-gradient(to top, rgba(239, 68, 68, ${0.85 + redMix * 0.15}), rgba(248, 113, 113, ${0.72 + redMix * 0.2}) 45%, rgba(254, 202, 202, ${0.5 + redMix * 0.3}) 100%)`
                        : `linear-gradient(to top, rgba(245, 158, 11, ${envLevel * 0.95}), rgba(251, 191, 36, ${envLevel * 0.8}) 50%, rgba(254, 243, 199, ${envLevel * 0.55}) 100%)`,
                    boxShadow:
                      envLevel > 0.05
                        ? redMix > 0
                          ? `inset 0 -${Math.round(envLevel * 75)}px 24px rgba(239, 68, 68, ${0.7 + redMix * 0.3}), 0 0 ${Math.round(redMix * 18)}px rgba(239, 68, 68, 0.75)`
                          : `inset 0 -${Math.round(envLevel * 55)}px 20px rgba(245, 158, 11, ${envLevel * 0.9})`
                        : 'none',
                  }}
                />

                {/* Live Key Tip Level Indicator - Red at top 15%, Amber otherwise */}
                {envLevel > 0.01 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 rounded-b pointer-events-none transition-colors"
                    style={{
                      opacity: Math.min(1, envLevel * 1.2),
                      backgroundColor: redMix > 0 ? '#ef4444' : '#f59e0b',
                      boxShadow: redMix > 0 ? '0 0 14px #ef4444' : '0 0 8px #f59e0b',
                    }}
                  />
                )}

                {k.pcKey && (
                  <span
                    className={`relative z-10 text-[9px] font-mono font-bold px-1 py-0.5 rounded mb-1 transition-colors ${
                      redMix > 0
                        ? 'bg-red-950/60 text-white font-extrabold'
                        : envLevel > 0.4
                        ? 'bg-black/20 text-black'
                        : 'bg-black/10 text-slate-700'
                    }`}
                  >
                    {k.pcKey}
                  </span>
                )}
                <span
                  className={`relative z-10 text-[9px] font-mono font-semibold transition-colors ${
                    redMix > 0
                      ? 'text-red-950 font-extrabold'
                      : envLevel > 0.4
                      ? 'text-black font-bold'
                      : 'text-slate-600'
                  }`}
                >
                  {k.label}
                </span>
              </div>
            );
          } else {
            // Black Key
            return (
              <div
                key={k.note}
                data-note={k.note}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  isMouseDownRef.current = true;
                  handleKeyTrigger(k.note);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  handleKeyRelease(k.note);
                }}
                onMouseEnter={() => {
                  if (isMouseDownRef.current) handleKeyTrigger(k.note);
                }}
                onMouseLeave={() => {
                  if (isMouseDownRef.current) handleKeyRelease(k.note);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyTrigger(k.note);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyRelease(k.note);
                }}
                className={`absolute z-20 h-24 sm:h-28 w-5 sm:w-7 -ml-2.5 sm:-ml-3.5 rounded-b flex flex-col justify-end items-center pb-1 cursor-pointer transition-all shadow-lg border border-black/80 select-none overflow-hidden ${
                  isActive
                    ? isTop15
                      ? 'bg-red-600 text-white shadow-[0_0_16px_#ef4444]'
                      : 'bg-amber-500 text-black shadow-[0_0_14px_#fbbf24]'
                    : 'bg-gradient-to-b from-[#2b3038] via-[#1a1d22] to-[#0c0e11] text-amber-200 hover:brightness-125'
                }`}
                style={{
                  // Position over boundary of adjacent white keys
                  left: `${(keys.filter((item, i) => !item.isBlack && keys.indexOf(k) > i).length / keys.filter(item => !item.isBlack).length) * 100}%`,
                }}
              >
                {/* Real-time Amp Envelope Highlight Overlay for Black Keys */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-b transition-all duration-75"
                  style={{
                    opacity: envLevel > 0.005 ? 1 : 0,
                    background:
                      redMix > 0
                        ? `linear-gradient(to top, rgba(239, 68, 68, ${0.92 + redMix * 0.08}), rgba(220, 38, 38, ${0.85 + redMix * 0.15}))`
                        : `linear-gradient(to top, rgba(245, 158, 11, ${envLevel * 0.95}), rgba(217, 119, 6, ${envLevel * 0.85}))`,
                    boxShadow:
                      envLevel > 0.05
                        ? redMix > 0
                          ? `0 0 ${Math.round(20 + redMix * 16)}px rgba(239, 68, 68, ${0.85 + redMix * 0.15})`
                          : `0 0 ${Math.round(envLevel * 20)}px rgba(245, 158, 11, ${envLevel})`
                        : 'none',
                  }}
                />

                {k.pcKey && (
                  <span
                    className={`relative z-10 text-[8px] font-mono font-bold mb-0.5 transition-colors ${
                      redMix > 0
                        ? 'text-white font-extrabold'
                        : envLevel > 0.4
                        ? 'text-black font-extrabold'
                        : 'text-amber-300/90'
                    }`}
                  >
                    {k.pcKey}
                  </span>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};
