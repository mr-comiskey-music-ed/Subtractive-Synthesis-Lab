import * as Tone from 'tone';
import { SynthParams, ArpConfig, ArpDivision, ArpDirection } from '../types';

export class SubtractiveEngine {
  private static instance: SubtractiveEngine | null = null;
  public isStarted: boolean = false;

  // Nodes
  private osc1: Tone.Oscillator | Tone.PulseOscillator | null = null;
  private osc2: Tone.Oscillator | Tone.PulseOscillator | null = null;
  private noise: Tone.Noise | null = null;

  private osc1Gain!: Tone.Gain;
  private osc2Gain!: Tone.Gain;
  private noiseGain!: Tone.Gain;

  private filter!: Tone.Filter;
  private filterEnv!: Tone.Envelope;
  private filterEnvGain!: Tone.Gain;

  private ampEnv!: Tone.AmplitudeEnvelope;
  private masterGain!: Tone.Gain;
  private limiter!: Tone.Limiter;
  private waveformAnalyzer!: Tone.Waveform;
  private fftAnalyzer!: Tone.FFT;
  private recorder!: Tone.Recorder;

  private lfo!: Tone.LFO;
  private lfoPitchGain1!: Tone.Gain;
  private lfoPitchGain2!: Tone.Gain;
  private lfoCutoffGain!: Tone.Gain;

  // State
  private currentParams: SynthParams;
  private activeNotes: Map<string, number> = new Map(); // note -> frequency
  private activeMidiKeys: Set<number> = new Set();
  private lastTriggeredFrequency: number = 261.63; // C4

  // Arpeggiator
  private arpConfig: ArpConfig = {
    enabled: false,
    bpm: 120,
    division: '16n',
    direction: 'up',
    octaves: 1,
  };
  private heldNotesList: string[] = [];
  private arpIndex: number = 0;
  private arpStepTimer: any = null;
  private arpLastNote: string | null = null;

  // Callbacks
  public onActiveNotesChange?: (notes: string[]) => void;
  private envelopeListeners: Array<(isHeld: boolean) => void> = [];

  public subscribeEnvelope(listener: (isHeld: boolean) => void): () => void {
    this.envelopeListeners.push(listener);
    return () => {
      this.envelopeListeners = this.envelopeListeners.filter((l) => l !== listener);
    };
  }

  private notifyEnvelope(isHeld: boolean) {
    this.envelopeListeners.forEach((fn) => {
      try {
        fn(isHeld);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private constructor(initialParams: SynthParams) {
    this.currentParams = { ...initialParams };
    this.setupAudioGraph();
  }

  public static getInstance(initialParams?: SynthParams): SubtractiveEngine {
    if (!SubtractiveEngine.instance) {
      if (!initialParams) {
        throw new Error('Initial parameters required to create audio engine');
      }
      SubtractiveEngine.instance = new SubtractiveEngine(initialParams);
    }
    return SubtractiveEngine.instance;
  }

  private setupAudioGraph() {
    // Master chain with Limiter for safety
    this.limiter = new Tone.Limiter(-1);
    this.masterGain = new Tone.Gain(this.currentParams.masterVolume);
    this.waveformAnalyzer = new Tone.Waveform(1024);
    this.fftAnalyzer = new Tone.FFT(512);
    this.recorder = new Tone.Recorder();

    // Amplitude Envelope
    this.ampEnv = new Tone.AmplitudeEnvelope({
      attack: this.currentParams.ampAttack,
      decay: this.currentParams.ampDecay,
      sustain: this.currentParams.ampSustain,
      release: this.currentParams.ampRelease,
    });

    // Filter
    this.filter = new Tone.Filter({
      frequency: this.currentParams.filterCutoff,
      type: 'lowpass',
      rolloff: this.currentParams.filterRolloff,
      Q: this.currentParams.filterResonance,
    });

    // Filter Envelope modulation
    this.filterEnv = new Tone.Envelope({
      attack: this.currentParams.modAttack,
      decay: this.currentParams.modDecay,
      sustain: this.currentParams.modSustain,
      release: this.currentParams.modRelease,
    });
    this.filterEnvGain = new Tone.Gain(0);
    this.filterEnv.connect(this.filterEnvGain);
    this.filterEnvGain.connect(this.filter.frequency);

    // Oscillator Gains
    this.osc1Gain = new Tone.Gain(this.currentParams.vco1Level);
    this.osc2Gain = new Tone.Gain(this.currentParams.vco2Level);
    this.noiseGain = new Tone.Gain(this.currentParams.noiseLevel);

    // Mixer sums into Filter
    this.osc1Gain.connect(this.filter);
    this.osc2Gain.connect(this.filter);
    this.noiseGain.connect(this.filter);

    // Filter -> Amp Envelope -> Master Gain -> Limiter -> Output & Analyzers
    this.filter.connect(this.ampEnv);
    this.ampEnv.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(Tone.getDestination());
    this.limiter.connect(this.waveformAnalyzer);
    this.limiter.connect(this.fftAnalyzer);
    this.limiter.connect(this.recorder);

    // LFO Modulation setup
    this.lfo = new Tone.LFO({
      frequency: this.currentParams.lfoRate,
      type: this.currentParams.lfoWaveform,
      min: -1,
      max: 1,
    });
    this.lfo.start();

    this.lfoPitchGain1 = new Tone.Gain(0);
    this.lfoPitchGain2 = new Tone.Gain(0);
    this.lfoCutoffGain = new Tone.Gain(0);

    this.lfo.connect(this.lfoPitchGain1);
    this.lfo.connect(this.lfoPitchGain2);
    this.lfo.connect(this.lfoCutoffGain);
    this.lfoCutoffGain.connect(this.filter.frequency);

    // Noise Generator
    this.noise = new Tone.Noise('white');
    this.noise.connect(this.noiseGain);
    this.noise.start();

    // Initialize Oscillators
    this.rebuildOscillators();
    this.applyParams(this.currentParams);
  }

  public async startAudioContext(): Promise<void> {
    if (!this.isStarted) {
      await Tone.start();
      this.isStarted = true;
    }
  }

  private rebuildOscillators() {
    // Dispose previous
    if (this.osc1) {
      this.osc1.stop();
      this.osc1.dispose();
      this.osc1 = null;
    }
    if (this.osc2) {
      this.osc2.stop();
      this.osc2.dispose();
      this.osc2 = null;
    }

    // VCO 1
    if (this.currentParams.vco1Waveform === 'square') {
      this.osc1 = new Tone.PulseOscillator({
        frequency: this.lastTriggeredFrequency,
        width: this.currentParams.vco1PulseWidth,
      });
    } else if (this.currentParams.vco1Waveform !== 'noise') {
      this.osc1 = new Tone.Oscillator({
        frequency: this.lastTriggeredFrequency,
        type: this.currentParams.vco1Waveform,
      });
    }

    // VCO 2
    if (this.currentParams.vco2Waveform === 'square') {
      this.osc2 = new Tone.PulseOscillator({
        frequency: this.lastTriggeredFrequency,
        width: this.currentParams.vco2PulseWidth,
      });
    } else if (this.currentParams.vco2Waveform !== 'noise') {
      this.osc2 = new Tone.Oscillator({
        frequency: this.lastTriggeredFrequency,
        type: this.currentParams.vco2Waveform,
      });
    }

    // Connect and start
    if (this.osc1) {
      this.osc1.connect(this.osc1Gain);
      this.lfoPitchGain1.connect(this.osc1.frequency);
      this.osc1.start();
    }

    if (this.osc2) {
      this.osc2.connect(this.osc2Gain);
      this.lfoPitchGain2.connect(this.osc2.frequency);
      this.osc2.start();
    }

    this.updatePitch(this.lastTriggeredFrequency);
  }

  public applyParams(params: Partial<SynthParams>) {
    this.currentParams = { ...this.currentParams, ...params };

    // Master
    if (params.masterVolume !== undefined) {
      this.masterGain.gain.rampTo(params.masterVolume, 0.05);
    }

    // VCO 1 Waveform / Pulsewidth
    if (params.vco1Waveform !== undefined && this.osc1) {
      this.rebuildOscillators();
    } else if (params.vco1PulseWidth !== undefined && this.osc1 instanceof Tone.PulseOscillator) {
      this.osc1.width.rampTo(params.vco1PulseWidth, 0.05);
    }

    // VCO 2 Waveform / Pulsewidth
    if (params.vco2Waveform !== undefined && this.osc2) {
      this.rebuildOscillators();
    } else if (params.vco2PulseWidth !== undefined && this.osc2 instanceof Tone.PulseOscillator) {
      this.osc2.width.rampTo(params.vco2PulseWidth, 0.05);
    }

    // Mixer
    const balance = this.currentParams.oscBalance; // -1 to +1
    // Left = 1, Right = 0 at -1; Left = 0.5, Right = 0.5 at 0; Left = 0, Right = 1 at +1
    const bal1 = balance <= 0 ? 1 : 1 - balance;
    const bal2 = balance >= 0 ? 1 : 1 + balance;

    const vco1Vol = this.currentParams.vco1Waveform === 'noise' ? 0 : this.currentParams.vco1Level * bal1;
    const vco2Vol = this.currentParams.vco2Waveform === 'noise' ? 0 : this.currentParams.vco2Level * bal2;
    const extraNoise = (this.currentParams.vco1Waveform === 'noise' ? this.currentParams.vco1Level : 0) +
                       (this.currentParams.vco2Waveform === 'noise' ? this.currentParams.vco2Level : 0);
    const noiseVol = Math.min(1, this.currentParams.noiseLevel + extraNoise);

    this.osc1Gain.gain.rampTo(vco1Vol, 0.02);
    this.osc2Gain.gain.rampTo(vco2Vol, 0.02);
    this.noiseGain.gain.rampTo(noiseVol, 0.02);

    // Filter
    if (params.filterRolloff !== undefined) {
      this.filter.rolloff = params.filterRolloff;
    }
    if (params.filterResonance !== undefined) {
      this.filter.Q.rampTo(params.filterResonance, 0.05);
    }

    // Filter Cutoff & Envelope Depth
    const baseCutoff = Math.max(20, Math.min(20000, this.currentParams.filterCutoff));
    this.filter.frequency.rampTo(baseCutoff, 0.05);

    const envAmount = this.currentParams.filterEnvAmount; // -100 to +100
    // Maximum frequency swing of up to 10,000 Hz based on envelope amount
    const envRange = (envAmount / 100) * 8000;
    this.filterEnvGain.gain.rampTo(envRange, 0.05);

    // Envelopes
    this.ampEnv.attack = Math.max(0.001, this.currentParams.ampAttack);
    this.ampEnv.decay = Math.max(0.01, this.currentParams.ampDecay);
    this.ampEnv.sustain = Math.max(0, Math.min(1, this.currentParams.ampSustain));
    this.ampEnv.release = Math.max(0.01, this.currentParams.ampRelease);

    this.filterEnv.attack = Math.max(0.001, this.currentParams.modAttack);
    this.filterEnv.decay = Math.max(0.01, this.currentParams.modDecay);
    this.filterEnv.sustain = Math.max(0, Math.min(1, this.currentParams.modSustain));
    this.filterEnv.release = Math.max(0.01, this.currentParams.modRelease);

    // LFO
    this.lfo.frequency.rampTo(Math.max(0.1, this.currentParams.lfoRate), 0.05);
    this.lfo.type = this.currentParams.lfoWaveform;

    const depth = this.currentParams.lfoDepth; // 0 to 1
    const dest = this.currentParams.lfoDestination;

    // Reset LFO gains
    this.lfoPitchGain1.gain.rampTo(dest === 'pitch' ? depth * 40 : 0, 0.05); // Hz pitch vibrato
    this.lfoPitchGain2.gain.rampTo(dest === 'pitch' ? depth * 40 : 0, 0.05);
    this.lfoCutoffGain.gain.rampTo(dest === 'cutoff' ? depth * 3500 : 0, 0.05); // Cutoff modulation

    // Update Pitch for any semi / fine change
    this.updatePitch(this.lastTriggeredFrequency);
  }

  private updatePitch(baseFreq: number) {
    this.lastTriggeredFrequency = baseFreq;

    // VCO 1
    const vco1SemiTotal = (this.currentParams.vco1Octave * 12) + this.currentParams.vco1Semi;
    const vco1Freq = baseFreq * Math.pow(2, (vco1SemiTotal + this.currentParams.vco1Fine / 100) / 12);

    if (this.osc1) {
      this.osc1.frequency.rampTo(vco1Freq, 0.01);
    }

    // VCO 2
    const vco2SemiTotal = (this.currentParams.vco2Octave * 12) + this.currentParams.vco2Semi;
    const vco2Freq = baseFreq * Math.pow(2, (vco2SemiTotal + this.currentParams.vco2Fine / 100) / 12);

    if (this.osc2) {
      this.osc2.frequency.rampTo(vco2Freq, 0.01);
    }

    // Filter Key Tracking (keyboard follow)
    const keyTrack = this.currentParams.filterKeyTracking; // 0 to 1
    if (keyTrack > 0) {
      // Calculate offset from C4 (261.63 Hz)
      const ratio = baseFreq / 261.63;
      const trackedCutoff = this.currentParams.filterCutoff * Math.pow(ratio, keyTrack);
      const clampedCutoff = Math.max(20, Math.min(20000, trackedCutoff));
      this.filter.frequency.rampTo(clampedCutoff, 0.02);
    }
  }

  public noteOn(note: string, velocity: number = 1.0) {
    if (!this.isStarted) {
      Tone.start();
      this.isStarted = true;
    }

    const freq = Tone.Frequency(note).toFrequency();
    this.activeNotes.set(note, freq);
    this.notifyActiveNotes();

    // If arpeggiator is running in Playground mode
    if (this.arpConfig.enabled) {
      if (!this.heldNotesList.includes(note)) {
        this.heldNotesList.push(note);
      }
      this.ensureArpRunning();
      return;
    }

    // Monophonic with high/last-note priority
    this.updatePitch(freq);
    this.ampEnv.triggerAttack(Tone.now(), velocity);
    this.filterEnv.triggerAttack(Tone.now());
    this.notifyEnvelope(true);
  }

  public noteOff(note: string) {
    this.activeNotes.delete(note);
    this.notifyActiveNotes();

    if (this.arpConfig.enabled) {
      this.heldNotesList = this.heldNotesList.filter((n) => n !== note);
      if (this.heldNotesList.length === 0) {
        this.stopArpTimer();
        this.ampEnv.triggerRelease();
        this.filterEnv.triggerRelease();
        this.notifyEnvelope(false);
      }
      return;
    }

    if (this.activeNotes.size === 0) {
      this.ampEnv.triggerRelease();
      this.filterEnv.triggerRelease();
      this.notifyEnvelope(false);
    } else {
      // Re-trigger latest remaining held note
      const remaining = Array.from(this.activeNotes.entries());
      const [lastNote, lastFreq] = remaining[remaining.length - 1];
      this.updatePitch(lastFreq);
    }
  }

  public allNotesOff() {
    this.activeNotes.clear();
    this.heldNotesList = [];
    this.stopArpTimer();
    this.ampEnv.triggerRelease();
    this.filterEnv.triggerRelease();
    this.notifyActiveNotes();
    this.notifyEnvelope(false);
  }

  private notifyActiveNotes() {
    if (this.onActiveNotesChange) {
      this.onActiveNotesChange(Array.from(this.activeNotes.keys()));
    }
  }

  // --- Arpeggiator Logic ---
  public setArpConfig(config: Partial<ArpConfig>) {
    this.arpConfig = { ...this.arpConfig, ...config };
    if (this.arpConfig.enabled && this.heldNotesList.length > 0) {
      this.stopArpTimer();
      this.ensureArpRunning();
    } else if (!this.arpConfig.enabled) {
      this.stopArpTimer();
    }
  }

  private stopArpTimer() {
    if (this.arpStepTimer) {
      clearInterval(this.arpStepTimer);
      this.arpStepTimer = null;
    }
    this.arpLastNote = null;
  }

  private ensureArpRunning() {
    if (this.arpStepTimer || this.heldNotesList.length === 0) return;

    const getIntervalMs = () => {
      const beatsPerSecond = this.arpConfig.bpm / 60;
      let multiplier = 4; // 16th note default
      if (this.arpConfig.division === '8n') multiplier = 2;
      if (this.arpConfig.division === '4n') multiplier = 1;
      return (1000 / beatsPerSecond) / multiplier;
    };

    const step = () => {
      if (this.heldNotesList.length === 0 || !this.arpConfig.enabled) {
        this.stopArpTimer();
        return;
      }

      // Generate sequence of notes across octaves
      const sorted = [...this.heldNotesList].sort(
        (a, b) => Tone.Frequency(a).toFrequency() - Tone.Frequency(b).toFrequency()
      );

      let sequence: string[] = [];
      for (let oct = 0; oct < this.arpConfig.octaves; oct++) {
        sequence.push(...sorted.map((n) => Tone.Frequency(n).transpose(oct * 12).toNote()));
      }

      let currentNote: string = sequence[0];
      if (sequence.length > 1) {
        if (this.arpConfig.direction === 'up') {
          currentNote = sequence[this.arpIndex % sequence.length];
          this.arpIndex = (this.arpIndex + 1) % sequence.length;
        } else if (this.arpConfig.direction === 'down') {
          const rev = [...sequence].reverse();
          currentNote = rev[this.arpIndex % rev.length];
          this.arpIndex = (this.arpIndex + 1) % rev.length;
        } else if (this.arpConfig.direction === 'upDown') {
          const upDown = [...sequence, ...sequence.slice(1, -1).reverse()];
          currentNote = upDown[this.arpIndex % upDown.length];
          this.arpIndex = (this.arpIndex + 1) % upDown.length;
        } else if (this.arpConfig.direction === 'random') {
          currentNote = sequence[Math.floor(Math.random() * sequence.length)];
        }
      } else {
        // Single note held down: repeat note rhythmically!
        currentNote = sequence[0];
      }

      // Trigger Note
      const freq = Tone.Frequency(currentNote).toFrequency();
      this.updatePitch(freq);
      this.ampEnv.triggerAttackRelease(getIntervalMs() * 0.0008, Tone.now());
      this.filterEnv.triggerAttackRelease(getIntervalMs() * 0.0008, Tone.now());
      this.arpLastNote = currentNote;
    };

    step();
    this.arpStepTimer = setInterval(step, getIntervalMs());
  }

  // --- Visualizer Accessors ---
  public getWaveformData(): Float32Array {
    return this.waveformAnalyzer.getValue() as Float32Array;
  }

  public getFFTData(): Float32Array {
    return this.fftAnalyzer.getValue() as Float32Array;
  }

  // --- Audio Recording (Snippet) ---
  public async startRecording(): Promise<void> {
    await this.startAudioContext();
    this.recorder.start();
  }

  public async stopRecording(): Promise<Blob> {
    const recording = await this.recorder.stop();
    return recording;
  }

  public getParams(): SynthParams {
    return { ...this.currentParams };
  }

  public setupMidi(onStatus?: (name: string) => void) {
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        (midiAccess) => {
          const inputs = midiAccess.inputs.values();
          let deviceName = 'Standard MIDI';
          for (const input of inputs) {
            deviceName = input.name || 'MIDI Device';
            input.onmidimessage = (msg) => this.handleMidiMessage(msg);
          }
          if (onStatus) onStatus(deviceName);
        },
        () => {
          if (onStatus) onStatus('MIDI Unavailable');
        }
      );
    }
  }

  private handleMidiMessage(event: { data: Uint8Array | number[] }) {
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;
    const noteName = Tone.Frequency(noteNumber, 'midi').toNote();

    if (command === 9 && velocity > 0) {
      this.noteOn(noteName, velocity / 127);
      this.activeMidiKeys.add(noteNumber);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      this.noteOff(noteName);
      this.activeMidiKeys.delete(noteNumber);
    }
  }
}
