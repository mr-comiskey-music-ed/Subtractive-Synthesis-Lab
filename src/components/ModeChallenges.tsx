import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  SynthParams,
  PatchMatcherChallenge,
  SynthDoctorTicket,
  BlindTestChallenge,
  ThemeMode,
} from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import {
  PATCH_MATCHER_CHALLENGES,
  SYNTH_DOCTOR_TICKETS,
  BLIND_TEST_CHALLENGES,
} from '../utils/presets';
import {
  Volume2,
  Stethoscope,
  Target,
  Ear,
  CheckCircle,
  AlertCircle,
  Trophy,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

interface ModeChallengesProps {
  engine: SubtractiveEngine;
  params: SynthParams;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onLoadParams: (newParams: SynthParams) => void;
  onRecordScore?: (taskId: string, title: string, score: number) => void;
}

export const ModeChallenges: React.FC<ModeChallengesProps> = ({
  engine,
  params,
  theme,
  onThemeChange,
  onLoadParams,
  onRecordScore,
}) => {
  const [activeCategory, setActiveCategory] = useState<'matcher' | 'doctor' | 'blind'>('matcher');

  // Patch Matcher State
  const [activePatchIdx, setActivePatchIdx] = useState<number>(0);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<string | null>(null);

  // Synth Doctor State
  const [activeTicketIdx, setActiveTicketIdx] = useState<number>(0);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'fixed' | 'failed'>('idle');
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);

  // Blind Ear Training State
  const [activeBlindIdx, setActiveBlindIdx] = useState<number>(0);
  const [blindSelected, setBlindSelected] = useState<'A' | 'B' | null>(null);
  const [blindResult, setBlindResult] = useState<boolean | null>(null);
  const [blindTotalScore, setBlindTotalScore] = useState<number>(0);

  // Reference Audio Player helper
  const playParamNotes = async (p: SynthParams, notes: string[], duration: number) => {
    await engine.startAudioContext();
    const originalParams = engine.getParams();

    // Temporarily apply target params
    engine.applyParams(p);

    notes.forEach((note, i) => {
      setTimeout(() => {
        engine.noteOn(note, 0.85);
        setTimeout(() => {
          engine.noteOff(note);
        }, duration * 800);
      }, i * (duration * 1000));
    });

    // Restore user params after playback
    const totalTime = notes.length * (duration * 1000) + 100;
    setTimeout(() => {
      engine.applyParams(originalParams);
    }, totalTime);
  };

  // Play Student's Current Sound
  const playCurrentSound = async (notes: string[], duration: number) => {
    await engine.startAudioContext();
    notes.forEach((note, i) => {
      setTimeout(() => {
        engine.noteOn(note, 0.85);
        setTimeout(() => {
          engine.noteOff(note);
        }, duration * 800);
      }, i * (duration * 1000));
    });
  };

  // 1. PATCH MATCHER ACCURACY CALCULATION
  const currentPatch = PATCH_MATCHER_CHALLENGES[activePatchIdx];

  const handleTestMatch = () => {
    const target = currentPatch.targetParams;
    let totalDifference = 0;
    let checkedFields = 0;

    // Compare waveform
    if (params.vco1Waveform === target.vco1Waveform) totalDifference += 0;
    else totalDifference += 20;
    checkedFields++;

    // Compare Cutoff (logarithmic difference)
    const logCutoffUser = Math.log10(Math.max(20, params.filterCutoff));
    const logCutoffTarget = Math.log10(Math.max(20, target.filterCutoff));
    const cutoffDiffPct = Math.min(1, Math.abs(logCutoffUser - logCutoffTarget) / 1.5);
    totalDifference += cutoffDiffPct * 25;
    checkedFields++;

    // Compare Resonance
    const resDiffPct = Math.min(1, Math.abs(params.filterResonance - target.filterResonance) / 15);
    totalDifference += resDiffPct * 15;
    checkedFields++;

    // Compare Amp Envelope Attack & Sustain
    const attackDiff = Math.min(1, Math.abs(params.ampAttack - target.ampAttack) / 1.5);
    const sustainDiff = Math.abs(params.ampSustain - target.ampSustain);
    totalDifference += (attackDiff * 15) + (sustainDiff * 15);
    checkedFields += 2;

    // Calculate score out of 100
    const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - totalDifference)));
    setMatchScore(calculatedScore);

    if (calculatedScore >= 80) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setMatchFeedback('Superb ear! You captured the harmonic character and contour within ±10% tolerance.');
    } else if (calculatedScore >= 55) {
      setMatchFeedback('Good effort! Check the hint below to get closer to the reference waveform or envelope.');
    } else {
      setMatchFeedback('Aural discrepancy detected. Listen closely to the reference and match the filter cutoff and sustain levels.');
    }

    if (onRecordScore) {
      onRecordScore(currentPatch.id, `Patch Matcher: ${currentPatch.title}`, calculatedScore);
    }
  };

  // 2. SYNTH DOCTOR VALIDATION
  const currentTicket = SYNTH_DOCTOR_TICKETS[activeTicketIdx];

  const handleLoadTicket = (idx: number) => {
    setActiveTicketIdx(idx);
    const t = SYNTH_DOCTOR_TICKETS[idx];
    onLoadParams({ ...t.brokenParams });
    onThemeChange(t.recommendedTheme);
    setTicketStatus('idle');
    setTicketMessage(null);
  };

  const handleSubmitFix = () => {
    const key = currentTicket.paramKey;
    const userVal = params[key];
    let isFixed = false;

    if (currentTicket.targetMin !== undefined && typeof userVal === 'number') {
      isFixed = userVal >= currentTicket.targetMin;
    } else if (currentTicket.targetMax !== undefined && typeof userVal === 'number') {
      isFixed = userVal <= currentTicket.targetMax;
    } else if (currentTicket.targetValue !== undefined) {
      isFixed = userVal === currentTicket.targetValue;
    }

    if (isFixed) {
      setTicketStatus('fixed');
      setTicketMessage(currentTicket.fixExplanation);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      if (onRecordScore) {
        onRecordScore(currentTicket.id, `Synth Doctor: #${currentTicket.ticketNumber} ${currentTicket.title}`, 100);
      }
    } else {
      setTicketStatus('failed');
      setTicketMessage(
        `Not quite resolved yet! Re-read the diagnostic clue: "${currentTicket.diagnosticClue}"`
      );
    }
  };

  // 3. BLIND EAR TRAINING LOGIC
  const currentBlind = BLIND_TEST_CHALLENGES[activeBlindIdx];

  const handleSelectBlindOption = (option: 'A' | 'B') => {
    setBlindSelected(option);
    const isCorrect = option === currentBlind.correctOption;
    setBlindResult(isCorrect);
    if (isCorrect) {
      setBlindTotalScore((prev) => prev + 1);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }
    if (onRecordScore) {
      onRecordScore(currentBlind.id, `Blind Ear Test: ${currentBlind.question}`, isCorrect ? 100 : 0);
    }
  };

  const handleNextBlind = () => {
    setBlindSelected(null);
    setBlindResult(null);
    setActiveBlindIdx((prev) => (prev + 1) % BLIND_TEST_CHALLENGES.length);
  };

  return (
    <div id="mode-challenges-panel" className="mb-4 space-y-3">
      {/* Category Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#121419] border border-[#262c37] p-2 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('matcher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'matcher'
                ? 'bg-amber-500 text-black shadow-[0_0_12px_#f59e0b]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-4 h-4" />
            1. Patch Matcher
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('doctor');
              handleLoadTicket(activeTicketIdx);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'doctor'
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_#10b981]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            2. Synth Doctor ({SYNTH_DOCTOR_TICKETS.length} Tickets)
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('blind')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeCategory === 'blind'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_#06b6d4]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ear className="w-4 h-4" />
            3. A/B Blind Ear Training
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 pr-2">
          Auto-Graded Learning Quests
        </div>
      </div>

      {/* --- SUB-VIEW 1: PATCH MATCHER --- */}
      {activeCategory === 'matcher' && (
        <div className="rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                QUEST 1: AURAL EAR TRAINING
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{currentPatch.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  {currentPatch.difficulty}
                </span>
              </h3>
            </div>

            {/* Patch Selector Buttons */}
            <div className="flex items-center gap-1">
              {PATCH_MATCHER_CHALLENGES.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePatchIdx(idx);
                    setMatchScore(null);
                    setMatchFeedback(null);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activePatchIdx
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-4">{currentPatch.description}</p>

          {/* Audio Reference vs My Synth Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(
                    currentPatch.targetParams,
                    currentPatch.referenceNotes,
                    currentPatch.referenceDuration
                  )
                }
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center gap-2 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                Play Hidden Reference Target
              </button>

              <button
                type="button"
                onClick={() =>
                  playCurrentSound(currentPatch.referenceNotes, currentPatch.referenceDuration)
                }
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-2 border border-white/10 active:scale-95"
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                Audition My Synth
              </button>
            </div>

            {/* Test Match Button */}
            <button
              type="button"
              onClick={handleTestMatch}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
            >
              <Trophy className="w-4 h-4" />
              Test Match (Auto-Grade)
            </button>
          </div>

          {/* Match Score Gauge / Feedback */}
          {matchScore !== null && (
            <div className="p-3 rounded-lg bg-black/60 border border-amber-500/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Match Score</span>
                  <span
                    className={`text-2xl font-mono font-bold ${
                      matchScore >= 80
                        ? 'text-emerald-400'
                        : matchScore >= 50
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {matchScore}%
                  </span>
                </div>
                <div className="text-xs text-slate-200">{matchFeedback}</div>
              </div>

              <div className="text-[11px] font-mono text-amber-300/80 bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/30">
                Hint: {currentPatch.hint}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUB-VIEW 2: SYNTH DOCTOR --- */}
      {activeCategory === 'doctor' && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                QUEST 2: SYNTH REPAIR WORKBENCH
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>
                  Ticket #{currentTicket.ticketNumber}: {currentTicket.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Theme: {currentTicket.recommendedTheme === 'studio-retro' ? 'Retro Synth' : 'Modern Synth'}
                </span>
              </h3>
            </div>

            {/* Ticket Selector Carousel */}
            <div className="flex items-center gap-1">
              {SYNTH_DOCTOR_TICKETS.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleLoadTicket(idx)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                    idx === activeTicketIdx
                      ? 'bg-emerald-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Client Complaint Box */}
          <div className="p-3 rounded-lg bg-black/40 border border-red-500/20 mb-3">
            <span className="text-[10px] font-mono text-red-400 uppercase font-bold block mb-1">
              Client Service Ticket Complaint:
            </span>
            <p className="text-xs text-slate-200 italic">"{currentTicket.clientComplaint}"</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-300 font-mono font-semibold">
                Diagnostic Clue:
              </span>
              <span className="text-xs text-slate-300">{currentTicket.diagnosticClue}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadTicket(activeTicketIdx)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reload Broken Patch
              </button>

              <button
                type="button"
                onClick={handleSubmitFix}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                Submit Fix
              </button>
            </div>
          </div>

          {/* Status Banner */}
          {ticketStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                ticketStatus === 'fixed'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/50 text-red-200'
              }`}
            >
              {ticketStatus === 'fixed' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <div className="text-xs leading-relaxed">{ticketMessage}</div>
            </div>
          )}
        </div>
      )}

      {/* --- SUB-VIEW 3: A/B BLIND EAR TRAINING --- */}
      {activeCategory === 'blind' && (
        <div className="rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900 to-slate-900 border border-cyan-500/30 p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                QUEST 3: A/B BLIND EAR TRAINING • QUESTION {activeBlindIdx + 1} OF{' '}
                {BLIND_TEST_CHALLENGES.length}
              </span>
              <h3 className="text-base font-bold text-white mt-1">{currentBlind.question}</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Score:</span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {blindTotalScore} / {BLIND_TEST_CHALLENGES.length}
              </span>
            </div>
          </div>

          {/* A vs B Sound Triggers & Answers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            {/* Tone A */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(currentBlind.optionA.params, [currentBlind.optionA.note], 1.2)
                }
                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
              >
                <Volume2 className="w-5 h-5" />
                Play Tone A
              </button>

              <button
                type="button"
                onClick={() => handleSelectBlindOption('A')}
                disabled={blindSelected !== null}
                className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                  blindSelected === 'A'
                    ? currentBlind.correctOption === 'A'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                }`}
              >
                Choose Tone A
              </button>
            </div>

            {/* Tone B */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  playParamNotes(currentBlind.optionB.params, [currentBlind.optionB.note], 1.2)
                }
                className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
              >
                <Volume2 className="w-5 h-5" />
                Play Tone B
              </button>

              <button
                type="button"
                onClick={() => handleSelectBlindOption('B')}
                disabled={blindSelected !== null}
                className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                  blindSelected === 'B'
                    ? currentBlind.correctOption === 'B'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                }`}
              >
                Choose Tone B
              </button>
            </div>
          </div>

          {/* Blind Explanation & Next Question */}
          {blindResult !== null && (
            <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {blindResult ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="text-xs text-slate-200">
                  <span className="font-bold mr-1">
                    {blindResult ? 'Correct!' : `Incorrect! Correct was Tone ${currentBlind.correctOption}.`}
                  </span>
                  {currentBlind.explanation}
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextBlind}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1 active:scale-95 flex-shrink-0"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
