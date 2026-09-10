import React, { useState } from 'react';
import { ThemeMode, SynthParams } from '../types';
import { SubtractiveEngine } from '../audio/synthEngine';
import { AdsrVisualizer } from './AdsrVisualizer';
import { CheckCircle2, ChevronRight, ChevronLeft, Volume2, Sparkles, RefreshCw } from 'lucide-react';

interface ModeLearnProps {
  engine: SubtractiveEngine;
  theme: ThemeMode;
  params: SynthParams;
  onThemeChange: (theme: ThemeMode) => void;
  onParamChange: (key: keyof SynthParams, val: any) => void;
}

interface StepInfo {
  stepNumber: number;
  title: string;
  concept: string;
  themeTarget: ThemeMode;
  highlightSection: 'vco' | 'filter' | 'envelope' | 'lfo';
  goalDescription: string;
  interactiveChallenge: string;
  targetParam: keyof SynthParams;
  initialValue: any;
  requiredCheck: (p: SynthParams) => boolean;
  notesToPlay: string[];
}

export const ModeLearn: React.FC<ModeLearnProps> = ({
  engine,
  theme,
  params,
  onThemeChange,
  onParamChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [soundPlayed, setSoundPlayed] = useState<boolean>(false);

  const steps: StepInfo[] = [
    {
      stepNumber: 1,
      title: 'Step 1: The Raw Waveform (Oscillator Vibration)',
      concept:
        'Subtractive synthesis begins with a raw, harmonically rich vibration. A Sawtooth wave contains all integer harmonics (buzzy and bright), while a Square wave has only odd harmonics (hollow and wooden, like a clarinet or retro 8-bit game).',
      themeTarget: 'studio-retro',
      highlightSection: 'vco',
      goalDescription:
        'Switch the VCO 1 waveform to Square or Sawtooth, and play a test tone to hear the contrast in harmonic content.',
      interactiveChallenge: 'Switch VCO 1 to "Square" wave and click "Audition Tone".',
      targetParam: 'vco1Waveform',
      initialValue: 'sawtooth',
      requiredCheck: (p) => p.vco1Waveform === 'square',
      notesToPlay: ['C3', 'G3', 'C4'],
    },
    {
      stepNumber: 2,
      title: 'Step 2: Dual Oscillator Voicing & Mixer (VCO 1 + VCO 2)',
      concept:
        'Analog synthesizers use dual oscillators to build thick acoustic weight. By turning up VCO 2 in the mixer, you combine two independent vibrating pitch generators into a single, powerhouse voice.',
      themeTarget: 'hardware-bench',
      highlightSection: 'vco',
      goalDescription:
        'Turn up VCO 2 Level in the mixer to at least 50% so both oscillators sing together.',
      interactiveChallenge: 'Raise VCO 2 Level to at least 0.50 (50%).',
      targetParam: 'vco2Level',
      initialValue: 0,
      requiredCheck: (p) => p.vco2Level >= 0.5,
      notesToPlay: ['C3', 'G3', 'C4'],
    },
    {
      stepNumber: 3,
      title: 'Step 3: Oscillator Detuning & Chorus Beating',
      concept:
        'When two oscillators play the exact same note slightly out of tune (cents detune), their waveforms drift in and out of phase. This creates a natural, lush acoustic chorus effect and thick "beating" that gives analog synths their famous warmth.',
      themeTarget: 'studio-retro',
      highlightSection: 'vco',
      goalDescription:
        'Detune VCO 2 by at least +10 or -10 cents to create an organic, chorused analog beating.',
      interactiveChallenge: 'Adjust VCO 2 Fine Detune to at least 10 cents (positive or negative).',
      targetParam: 'vco2Fine',
      initialValue: 0,
      requiredCheck: (p) => Math.abs(p.vco2Fine) >= 10,
      notesToPlay: ['A3', 'C4', 'E4'],
    },
    {
      stepNumber: 4,
      title: 'Step 4: Pulse Width & PWM (Altering the Wave Symmetry)',
      concept:
        'A square wave is normally balanced 50% high and 50% low. Adjusting the Pulse Width changes the duty cycle: narrowing it produces a thin, nasal, reed-like tone like an oboe or funky clavinet. Modulating this continuously with an LFO produces iconic Pulse Width Modulation (PWM)!',
      themeTarget: 'hardware-bench',
      highlightSection: 'vco',
      goalDescription:
        'Set VCO 1 to Square wave, then turn the Shape/PWM knob to thin out the duty cycle (< 35% or > 65%).',
      interactiveChallenge: 'Switch VCO 1 to Square and set Pulse Width (Shape) below 35% or above 65%.',
      targetParam: 'vco1PulseWidth',
      initialValue: 0.5,
      requiredCheck: (p) => p.vco1Waveform === 'square' && (p.vco1PulseWidth <= 0.38 || p.vco1PulseWidth >= 0.62),
      notesToPlay: ['D3', 'F#3', 'A3'],
    },
    {
      stepNumber: 5,
      title: 'Step 5: White Noise Generator (Percussion & Transients)',
      concept:
        'Unlike oscillators that play a definite pitch, White Noise contains every frequency in the audio spectrum with equal energy. Noise is crucial for programming percussive snare snaps, flute chiff breath, ocean breezes, and storm gusts.',
      themeTarget: 'studio-retro',
      highlightSection: 'vco',
      goalDescription:
        'Raise the Noise level in the mixer to blend white noise into your sound.',
      interactiveChallenge: 'Turn Noise Level to at least 25% in the mixer.',
      targetParam: 'noiseLevel',
      initialValue: 0,
      requiredCheck: (p) => p.noiseLevel >= 0.2,
      notesToPlay: ['C3'],
    },
    {
      stepNumber: 6,
      title: 'Step 6: The Subtractive Door (Low-Pass Filter Cutoff)',
      concept:
        'The filter is the signature engine of subtractive synthesis! A Low-Pass Filter allows low frequencies to pass while progressively cutting off ("subtracting") upper harmonics. Sweeping Cutoff downward turns bright buzzing brass into deep, warm, muffled velvet.',
      themeTarget: 'hardware-bench',
      highlightSection: 'filter',
      goalDescription:
        'Lower the Filter Cutoff below 1,600 Hz to muffle the top-end buzz and hear the subtractive carving.',
      interactiveChallenge: 'Turn Filter Cutoff down below 1,600 Hz.',
      targetParam: 'filterCutoff',
      initialValue: 12000,
      requiredCheck: (p) => p.filterCutoff <= 1800,
      notesToPlay: ['F3', 'A3', 'C4'],
    },
    {
      stepNumber: 7,
      title: 'Step 7: Resonance (Q) & Self-Oscillation Peak',
      concept:
        'Resonance (Q) feeds the filtered audio back into the filter circuit, creating a sharp emphasis spike right at the Cutoff frequency. At moderate levels, it gives an expressive vocal "wah-wah" or squelch. Cranked to maximum, it self-oscillates into a whistling feedback laser!',
      themeTarget: 'studio-retro',
      highlightSection: 'filter',
      goalDescription:
        'Boost Filter Resonance above 7.0 and hear the whistling harmonic peak ringing at the cutoff.',
      interactiveChallenge: 'Set Filter Resonance to 7.0 or higher.',
      targetParam: 'filterResonance',
      initialValue: 1,
      requiredCheck: (p) => p.filterResonance >= 7,
      notesToPlay: ['G3', 'B3', 'D4'],
    },
    {
      stepNumber: 8,
      title: 'Step 8: The Sculptor of Time (Amp ADSR Envelope)',
      concept:
        'Natural acoustic instruments do not turn on and off like light switches. The Amplitude ADSR Envelope shapes volume across time: Attack (initial rise time), Decay (fall to sustain), Sustain (steady volume while holding the key), and Release (fade out after letting go). Watch the visualizer below and the keys on your keyboard glow in real time with the envelope contour!',
      themeTarget: 'hardware-bench',
      highlightSection: 'envelope',
      goalDescription:
        'Transform this into a slow, evolving pad or ambient string sound: increase Amp Attack above 0.4s and Release above 1.0s.',
      interactiveChallenge: 'Set Amp Attack (A) >= 0.4s and Amp Release (R) >= 1.0s.',
      targetParam: 'ampAttack',
      initialValue: 0.01,
      requiredCheck: (p) => p.ampAttack >= 0.35 && p.ampRelease >= 0.8,
      notesToPlay: ['C4', 'E4', 'G4', 'B4'],
    },
    {
      stepNumber: 9,
      title: 'Step 9: Dynamic Keystroke Sweeps (Filter / Mod Envelope)',
      concept:
        'Instead of leaving the filter cutoff frozen, the Filter Envelope sweeps the cutoff frequency dynamically with each keystroke. A fast decay with zero sustain creates snappy bass plucks and 80s brass stabs, while a slow attack creates expressive swells.',
      themeTarget: 'studio-retro',
      highlightSection: 'filter',
      goalDescription:
        'Keep Cutoff low (< 1,500 Hz), set Filter Envelope Amount (EG Depth) to at least +45%, and hear the filter open and close dynamically.',
      interactiveChallenge: 'Set Filter Cutoff < 1500 Hz AND Filter Env Amount >= 45%.',
      targetParam: 'filterEnvAmount',
      initialValue: 0,
      requiredCheck: (p) => p.filterCutoff <= 1600 && p.filterEnvAmount >= 45,
      notesToPlay: ['D3', 'F3', 'A3', 'D4'],
    },
    {
      stepNumber: 10,
      title: 'Step 10: The Automated Robot Hand (LFO Modulation)',
      concept:
        'The LFO (Low Frequency Oscillator) cycles at sub-audible rates (0.1 to 20Hz). It acts like a robotic hand continuously wiggling a control knob. Route it to Pitch for pitch vibrato, to Filter Cutoff for an automated pulsing wah-wah, or to PWM for chorused shimmer!',
      themeTarget: 'hardware-bench',
      highlightSection: 'lfo',
      goalDescription:
        'Assign LFO to Pitch, set LFO Rate around 5 Hz, and turn up Depth above 25% to generate rhythmic pitch vibrato.',
      interactiveChallenge: 'Set LFO Target to "Pitch" and increase LFO Depth to at least 25%.',
      targetParam: 'lfoDepth',
      initialValue: 0,
      requiredCheck: (p) => p.lfoDestination === 'pitch' && p.lfoDepth >= 0.22,
      notesToPlay: ['A3', 'C#4', 'E4'],
    },
  ];

  const currentStep = steps[currentStepIndex];
  const isRequirementMet = currentStep.requiredCheck(params) && soundPlayed;

  const handlePlayNotes = async () => {
    await engine.startAudioContext();
    setSoundPlayed(true);
    setHasInteracted(true);

    // Play notes sequence
    currentStep.notesToPlay.forEach((note, index) => {
      setTimeout(() => {
        engine.noteOn(note, 0.85);
        setTimeout(() => {
          engine.noteOff(note);
        }, 500);
      }, index * 600);
    });
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setSoundPlayed(false);
      // Auto-switch theme to demonstrate both interfaces
      onThemeChange(steps[nextIdx].themeTarget);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      setSoundPlayed(false);
      onThemeChange(steps[prevIdx].themeTarget);
    }
  };

  return (
    <div id="mode-learn-overlay" className="mb-4">
      {/* Top Walkthrough Banner Card */}
      <div className="rounded-xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 p-4 border border-amber-500/40 shadow-2xl text-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-black font-bold text-sm shadow-[0_0_12px_#f59e0b]">
              {currentStep.stepNumber}
            </span>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-amber-300 uppercase font-bold">
                GUIDED WALKTHROUGH • STEP {currentStep.stepNumber} OF {steps.length}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {currentStep.title}
              </h3>
            </div>
          </div>

          {/* Theme Target Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-mono">Current Theme:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded font-bold font-mono uppercase ${
                theme === 'studio-retro'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {theme === 'studio-retro' ? 'Retro Synth' : 'Modern Synth'}
            </span>
            <button
              type="button"
              onClick={() =>
                onThemeChange(theme === 'studio-retro' ? 'hardware-bench' : 'studio-retro')
              }
              className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-1 transition-colors"
              title="Toggle theme manually"
            >
              <RefreshCw className="w-3 h-3" />
              Switch
            </button>
          </div>
        </div>

        {/* Pedagogical Explanation Text */}
        <p className="text-sm text-slate-200 leading-relaxed mb-4 max-w-4xl">
          {currentStep.concept}
        </p>

        {/* Live ADSR Visualizer Diagram on Envelope Steps */}
        {(currentStep.stepNumber === 8 || currentStep.stepNumber === 9) && (
          <div className="mb-4 p-3 rounded-lg bg-black/50 border border-amber-500/30 max-w-xl">
            <span className="text-[11px] font-mono text-amber-300 font-bold block mb-1.5 uppercase tracking-wide">
              {currentStep.stepNumber === 8 ? 'Active Amplitude ADSR Envelope Contour' : 'Active Filter ADSR Envelope Contour'}
            </span>
            <AdsrVisualizer
              attack={currentStep.stepNumber === 8 ? params.ampAttack : params.modAttack}
              decay={currentStep.stepNumber === 8 ? params.ampDecay : params.modDecay}
              sustain={currentStep.stepNumber === 8 ? params.ampSustain : params.modSustain}
              release={currentStep.stepNumber === 8 ? params.ampRelease : params.modRelease}
              height={120}
              theme="diagram"
              engine={engine}
            />
          </div>
        )}

        {/* Interactive Challenge & Progress Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                Your Hands-On Mission:
              </span>
              <span className="text-xs text-slate-200 font-mono">
                {currentStep.interactiveChallenge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayNotes}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] active:scale-95 transition-all"
            >
              <Volume2 className="w-4 h-4" />
              Audition Tone
            </button>

            {/* Checkmark requirement badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                isRequirementMet
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800 text-slate-400 border-white/10'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 ${isRequirementMet ? 'text-emerald-400' : 'text-slate-500'}`}
              />
              <span>{isRequirementMet ? 'Parameter & Sound Heard!' : 'Tweak & Audition'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Step Buttons */}
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-white/10 text-xs">
          <button
            type="button"
            disabled={currentStepIndex === 0}
            onClick={handlePrevStep}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Step
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentStepIndex
                    ? 'bg-amber-400 scale-125 shadow-[0_0_6px_#f59e0b]'
                    : i < currentStepIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={!isRequirementMet && currentStepIndex !== steps.length - 1}
            onClick={handleNextStep}
            className={`px-4 py-1.5 rounded font-bold flex items-center gap-1 transition-all ${
              isRequirementMet
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{currentStepIndex === steps.length - 1 ? 'Walkthrough Complete' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
