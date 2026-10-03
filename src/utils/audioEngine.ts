/**
 * MixFlow Web Audio Engine
 * Provides dual-mode playback:
 * 1. Native synthesized analog music groove (chords + bass + percussion) via Web Audio API
 * 2. Uploaded audio files via HTML5 Audio / AudioContext
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private synthInterval: number | null = null;
  private currentStep = 0;
  private masterGain: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private activeUrl: string | null = null;
  private volume = 0.8;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onStateChangeCallback: ((isPlaying: boolean) => void) | null = null;
  private duration = 184; // 3m 04s default
  private currentTime = 0;
  private timerInterval: number | null = null;

  constructor() {
    // Lazy initialized on user gesture
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setCallbacks(onTimeUpdate: (time: number) => void, onStateChange: (isPlaying: boolean) => void) {
    this.onTimeUpdateCallback = onTimeUpdate;
    this.onStateChangeCallback = onStateChange;
  }

  public loadTrack(url?: string, duration = 184) {
    this.pause();
    this.duration = duration;
    this.currentTime = 0;
    this.activeUrl = url || null;

    if (url && url !== '#' && (url.startsWith('blob:') || url.startsWith('http') || url.startsWith('data:'))) {
      if (!this.audioElement) {
        this.audioElement = new Audio();
        this.audioElement.addEventListener('timeupdate', () => {
          if (this.audioElement) {
            this.currentTime = this.audioElement.currentTime;
            this.onTimeUpdateCallback?.(this.currentTime);
          }
        });
        this.audioElement.addEventListener('ended', () => {
          this.pause();
          this.seek(0);
        });
      }
      this.audioElement.src = url;
      this.audioElement.volume = this.volume;
    } else {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement = null;
      }
    }
    this.onTimeUpdateCallback?.(0);
  }

  public play() {
    this.initContext();
    this.isPlaying = true;
    this.onStateChangeCallback?.(true);

    if (this.audioElement && this.activeUrl) {
      this.audioElement.play().catch(() => {
        // Fallback to synth if autoplay blocked
        this.startSynthLoop();
      });
    } else {
      this.startSynthLoop();
    }

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (this.isPlaying) {
        this.currentTime += 0.25;
        if (this.currentTime >= this.duration) {
          this.currentTime = 0;
        }
        this.onTimeUpdateCallback?.(this.currentTime);
      }
    }, 250);
  }

  public pause() {
    this.isPlaying = false;
    this.onStateChangeCallback?.(false);
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(time: number) {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    if (this.audioElement && this.activeUrl) {
      this.audioElement.currentTime = this.currentTime;
    }
    this.onTimeUpdateCallback?.(this.currentTime);
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  public getVolume() {
    return this.volume;
  }

  public getDuration() {
    return this.duration;
  }

  public getCurrentTime() {
    return this.currentTime;
  }

  public getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * Synthesizes a warm, rhythmic neo-soul/synthwave progression:
   * Chords: Dm9 -> G13 -> Cmaj9 -> Am7
   * Bass: deep sub oscillator with low-pass filter
   * Percussion: soft kick and noise hi-hat
   */
  private startSynthLoop() {
    if (this.synthInterval) clearInterval(this.synthInterval);
    const bpm = 112;
    const stepDurationMs = (60 / bpm / 2) * 1000; // eighth notes

    const chordProgression = [
      [146.83, 220.00, 261.63, 329.63], // Dm9 (D3, A3, C4, E4)
      [98.00, 196.00, 246.94, 329.63],  // G13 (G2, G3, B3, E4)
      [130.81, 196.00, 246.94, 293.66], // Cmaj9 (C3, G3, B3, D4)
      [110.00, 164.81, 220.00, 261.63]  // Am7 (A2, E3, A3, C4)
    ];

    const bassNotes = [73.42, 73.42, 98.00, 98.00, 65.41, 65.41, 55.00, 55.00];

    this.synthInterval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const step = this.currentStep % 16;
      this.currentStep++;

      // Trigger kick on 0, 4, 8, 12
      if (step % 4 === 0) {
        this.triggerKick(t);
      }

      // Trigger hi-hat on 2, 6, 10, 14
      if (step % 2 === 0) {
        this.triggerHat(t, step % 4 === 2 ? 0.08 : 0.04);
      }

      // Trigger chord pad on step 0, 8
      if (step % 8 === 0) {
        const chordIndex = Math.floor(this.currentStep / 8) % chordProgression.length;
        this.triggerChord(chordProgression[chordIndex], t);
      }

      // Bassline on every 2nd step
      if (step % 2 === 0) {
        const bassIndex = Math.floor(step / 2) % bassNotes.length;
        this.triggerBass(bassNotes[bassIndex], t);
      }
    }, stepDurationMs);
  }

  private triggerKick(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private triggerHat(time: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    // Simple noise generator
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  private triggerChord(freqs: number[], time: number) {
    if (!this.ctx || !this.masterGain) return;
    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const filter = this.ctx!.createBiquadFilter();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, time);
      filter.Q.setValueAtTime(2, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.06, time + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + 1.5);
    });
  }

  private triggerBass(freq: number, time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.4);
  }
}

export const globalAudioEngine = new AudioEngine();

/**
 * Generates reproducible waveform peaks between 0.15 and 0.95
 * with realistic musical dynamics (verse, chorus, breakdown, drop).
 */
export function generateWaveformPeaks(seed: number, count = 100, compression = 1): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    // Musical section dynamics simulation:
    // 0-25: Intro/Verse, 25-50: Build/Chorus 1, 50-65: Breakdown, 65-90: Climax, 90-100: Outro
    const sectionFactor = 
      i < 20 ? 0.45 + 0.2 * Math.sin(i * 0.4) :
      i < 50 ? 0.75 + 0.2 * Math.cos(i * 0.3) :
      i < 65 ? 0.35 + 0.15 * Math.sin(i * 0.5) :
      i < 90 ? 0.85 + 0.15 * Math.sin(i * 0.6) :
      0.4 - (i - 90) * 0.03;

    // Pseudo-random jitter with seed
    const pseudoRandom = Math.abs(Math.sin((i + 1) * seed * 19.345) * 0.45);
    let raw = sectionFactor * 0.6 + pseudoRandom * 0.4;
    
    // Apply compression factor (for V2/V3 mastering)
    if (compression > 1) {
      raw = Math.pow(raw, 0.75) * 1.15;
    }
    
    peaks.push(Math.max(0.12, Math.min(0.98, raw)));
  }
  return peaks;
}
