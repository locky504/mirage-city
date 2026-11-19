// Procedural WebAudio: every sound and the music loop are synthesized, no
// audio files. The engine is created on the first user gesture (browsers
// block audio before that) and every call is safe before init.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.step = 0;
    this.nextNoteTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngineHum();
      this.startMusic();
    } catch (e) { /* audio unavailable: game stays silent */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  // --- one-shot effects -------------------------------------------------
  blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, lowFreq = 400) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noiseBurst(0.14, 0.5, 2600); this.blip(160, 0.09, 'square', 0.22, 55); }
  enemyShoot() { this.noiseBurst(0.1, 0.18, 1800); }
  pickup() { this.blip(660, 0.1, 'sine', 0.3); setTimeout(() => this.blip(990, 0.14, 'sine', 0.3), 90); }
  cash() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.28), i * 70)); }
  crash() { this.noiseBurst(0.25, 0.4, 500); this.blip(70, 0.2, 'sine', 0.3, 35); }
  horn() { this.blip(370, 0.18, 'square', 0.12); this.blip(466, 0.18, 'square', 0.1); }
  wasted() { [392, 311, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'sawtooth', 0.22), i * 220)); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.28), i * 130)); }

  // --- continuous layers ------------------------------------------------
  startEngineHum() {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 55;
    g.gain.value = 0.0;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start();
    this.engineOsc = o;
    this.engineGain = g;
  }

  setEngine(speedRatio, driving) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.05 : 0.0, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 700;
      g.gain.value = 0.045;
      o.connect(g); g.connect(this.master);
      o.start();
      this.sirenOsc = o; this.sirenGain = g;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain();
      lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start();
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }

  // --- music: a dusty desert-night groove, A minor, scheduled ahead -----
  startMusic() {
    // Bass line (Hz): A1 A1 C2 E2 | A1 A1 G1 E2, plus a sparse pluck melody.
    const bass = [55, 55, 65.41, 82.41, 55, 55, 49, 82.41];
    const pluck = [220, 0, 261.63, 0, 329.63, 0, 261.63, 196];
    const stepDur = 0.24;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        const i = this.step % 8;
        const t = this.nextNoteTime;
        if (bass[i]) this.noteAt(bass[i], t, stepDur * 0.95, 'triangle', 0.16);
        if (pluck[i]) this.noteAt(pluck[i], t, stepDur * 0.5, 'sine', 0.07);
        if (this.step % 2 === 0) this.hatAt(t, 0.03);
        this.nextNoteTime += stepDur;
        this.step++;
      }
    }, 120);
  }

  noteAt(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hatAt(t, vol) {
    const len = Math.floor(this.ctx.sampleRate * 0.04);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
}
