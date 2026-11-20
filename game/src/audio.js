// Sound for Solmara, synthesised with WebAudio — no audio files, no network.
// A tiny chiptune loop (bass + lead + hats), an engine hum that follows the
// car's speed, a two-tone siren while the wanted level is up, and one-shot
// effects for shots, punches, pickups and mission banners. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  // A sunny, slightly tense loop in A minor: bass walks, lead answers.
  const BASS = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
  const LEAD = [440, 0, 523.25, 0, 659.25, 0, 587.33, 523.25, 440, 0, 392, 0, 329.63, 392, 440, 0];
  const STEP_MS = 190;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type ?? 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol ?? 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low ?? 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol ?? 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.05;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const bar = Math.floor(musicStep / 8) % 2;
      const bass = BASS[musicStep % 8];
      const lead = LEAD[musicStep % 16];
      tone(bass, STEP_MS / 1000 * 0.9, 'triangle', 0.16);
      if (lead) tone(lead, STEP_MS / 1000 * 0.7, 'square', 0.05);
      if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
      if (bar === 1 && musicStep % 8 === 4) tone(880, 0.3, 'sine', 0.06);
      musicStep += 1;
    }, STEP_MS);
  }

  return {
    /** Call from a user gesture (start button, first key): browsers need one. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startEngine();
      startSiren();
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    /** Per-frame: engine pitch from speed, siren wail while wanted. */
    update(speed, wanted, time) {
      if (!ctx || muted) return;
      if (engineGain) {
        engineGain.gain.value = speed > 20 ? 0.05 + Math.min(0.08, speed / 6000) : 0.012;
        if (engineOsc) engineOsc.frequency.value = 55 + speed * 0.22;
      }
      if (sirenOsc) {
        sirenOsc.frequency.value = wanted > 0 ? (Math.sin(time * 5) > 0 ? 720 : 960) : 720;
        if (sirenGain) sirenGain.gain.value = wanted > 0 ? 0.045 : 0;
      }
    },
    shoot() { noise(0.12, 0.25, 900); tone(180, 0.08, 'square', 0.14, 0, 60); },
    punch() { noise(0.08, 0.18, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.14); tone(990, 0.14, 'sine', 0.14, 0.08); },
    crime() { tone(220, 0.18, 'sawtooth', 0.1, 0, 110); },
    mission() {
      tone(523.25, 0.14, 'square', 0.1);
      tone(659.25, 0.14, 'square', 0.1, 0.13);
      tone(783.99, 0.3, 'square', 0.1, 0.26);
    },
    busted() { tone(392, 0.3, 'sawtooth', 0.12, 0, 196); tone(196, 0.5, 'sawtooth', 0.12, 0.28); },
    click() { tone(880, 0.05, 'square', 0.08); },
  };
}
