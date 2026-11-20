// Solmara — synthesized sound. No audio files: every effect is built
// with the Web Audio API so the game stays offline and self-contained.
// Audio only starts after the player's first key or click, as browsers
// require, and a mute toggle (M) silences everything.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    // A short blip: square wave with a fast pitch slide.
    blip(freq, dur, type, vol) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol || 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    // White-noise burst through a low-pass filter: gunshots, crashes.
    noise(dur, cutoff, vol) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t);
    },

    gunshot() {
      this.noise(0.14, 2400, 0.35);
      this.blip(180, 0.08, 'sawtooth', 0.12);
    },

    crash() {
      this.noise(0.28, 700, 0.4);
    },

    pickup() {
      this.blip(660, 0.09, 'sine', 0.16);
      setTimeout(() => this.blip(990, 0.12, 'sine', 0.16), 90);
    },

    missionDone() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 110));
    },

    busted() {
      const notes = [392, 330, 262];
      notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.14), i * 160));
    },

    // Continuous engine hum whose pitch follows the car's speed.
    setEngine(speed01, on) {
      if (!this.ctx) return;
      if (!on) {
        if (this.engineOsc) {
          try { this.engineOsc.stop(); } catch { /* already stopped */ }
          this.engineOsc = null;
          this.engineGain = null;
        }
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05 + speed01 * 0.05, t, 0.1);
    },

    // Two-tone police siren that fades in and out with the chase.
    setSiren(on) {
      if (!this.ctx) return;
      if (!on) {
        if (this.sirenOsc) {
          try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* stopped */ }
          this.sirenOsc = null;
          this.sirenGain = null;
          this.sirenLfo = null;
        }
        return;
      }
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 750;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.type = 'square';
        this.sirenLfo.frequency.value = 0.7;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.0;
        this.sirenOsc.connect(this.sirenGain).connect(this.master);
        this.sirenOsc.start();
        this.sirenLfo.start();
      }
      this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.045, this.ctx.currentTime, 0.4);
    },
  };
  return audio;
}
