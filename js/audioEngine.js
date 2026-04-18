// ============================================================
// AUDIO ENGINE — Web Audio API (Procédural & Adaptatif)
// ============================================================
export class AudioEngine {
    constructor() {
        this.ctx= null;
        this.started    = false;
        this.muted      = false;
        this._inf       = 0;   // infection level courant
        this._step      = 0;   // pas du séquenceur
        this._arpIdx    = 0;   // index arpège
        this._rhythmTmr = null;
        this._arpTmr    = null;
    }

    start() {
        if (this.started) return;
        this.ctx     = new (window.AudioContext || window.webkitAudioContext)();
        this.started = true;
        this._buildGraph();
        this._startDrone();
        this._scheduleRhythm();
        this._scheduleArp();
        this.droneGain.gain.linearRampToValueAtTime(0.26, this.ctx.currentTime + 2.2);
        this.arpGain.gain.linearRampToValueAtTime(0.1,   this.ctx.currentTime + 3.8);
        setTimeout(() => this._playStartup(), 300);
    }

    _buildGraph() {
        const c = this.ctx;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 8;
        comp.ratio.value     = 4;   comp.attack.value = 0.005;
        comp.release.value   = 0.3;
        comp.connect(c.destination);

        this.masterGain = c.createGain(); this.masterGain.gain.value = 0.78;
        this.masterGain.connect(comp);

        this.droneGain  = c.createGain(); this.droneGain.gain.value  = 0;
        this.bassGain   = c.createGain(); this.bassGain.gain.value   = 0;
        this.rhythmGain = c.createGain(); this.rhythmGain.gain.value = 0;
        this.arpGain    = c.createGain(); this.arpGain.gain.value    = 0;
        this.chaosGain  = c.createGain(); this.chaosGain.gain.value  = 0;

        [this.droneGain, this.bassGain, this.rhythmGain,
         this.arpGain,   this.chaosGain].forEach(g => g.connect(this.masterGain));
    }

    _startDrone() {
        const c = this.ctx;
        [[55, 0], [110, 7], [165, -5]].forEach(([freq, detune], i) => {
            const osc = c.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value    = detune;
            const lfo  = c.createOscillator();
            lfo.frequency.value = 0.11 + i * 0.04;
            const lfoG = c.createGain(); lfoG.gain.value = 140;
            lfo.connect(lfoG);
            const flt = c.createBiquadFilter();
            flt.type = 'lowpass'; flt.frequency.value = 850; flt.Q.value = 1.6;
            lfoG.connect(flt.frequency);
            const g = c.createGain(); g.gain.value = 0.11;
            osc.connect(flt); flt.connect(g); g.connect(this.droneGain);
            osc.start(); lfo.start();
        });
    }

    _scheduleRhythm() {
        if (!this.started) return;
        const inf = this._inf;
        const t   = this.ctx.currentTime;
        const bpm = 120 + inf * 26;
        const s16  = (60 / bpm) / 4;
        const kickPat  = [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,1];
        const snarePat = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
        const bassPat  = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0];
        const s = this._step % 16;
        if (kickPat[s])      this._kick(t,  0.55 + inf * 0.35);
        if (s % 2 === 1)      this._hihat(t, 0.07 + inf * 0.13);
        if (snarePat[s])      this._snare(t, 0.26 + inf * 0.32);
        if (bassPat[s] && inf > 0.18) this._bass(t,  inf);
        if (inf > 0.63 && Math.random() < 0.2) this._glitchHit(t);
        this._step++;
        this._rhythmTmr = setTimeout(() => this._scheduleRhythm(), s16 * 1000);
    }

    _scheduleArp() {
        if (!this.started || !this.ctx) return;
        const inf = this._inf;
        const vol = Math.max(0, 0.095 - inf * 0.11);
        this.arpGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.15);
        if (inf < 0.88) {
            const notes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
            const freq  = notes[this._arpIdx % notes.length];
            const f = (inf > 0.5 && Math.random() < inf * 0.32)
                ? freq * (1 + (Math.random() - 0.5) * 0.09) : freq;
            this._arpNote(f);
            this._arpIdx++;
        }
        const ms = 235 - inf * 95;
        this._arpTmr = setTimeout(() => this._scheduleArp(), ms);
    }

    _noiseBuf(dur) {
        const sz  = Math.ceil(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, sz, this.ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        return s;
    }

    _kick(t, vol) {
        const o = this.ctx.createOscillator();
        o.frequency.setValueAtTime(165, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.09);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
        o.connect(g); g.connect(this.rhythmGain);
        o.start(t); o.stop(t + 0.26);
    }

    _hihat(t, vol) {
        const n = this._noiseBuf(0.045);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 7500;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        n.connect(f); f.connect(g); g.connect(this.rhythmGain);
        n.start(t);
    }

    _snare(t, vol) {
        const c = this.ctx;
        const n = this._noiseBuf(0.13);
        const f = c.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 560; f.Q.value = 0.55;
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        n.connect(f); f.connect(g); g.connect(this.rhythmGain); n.start(t);
        const o = c.createOscillator();
        o.type = 'triangle'; o.frequency.value = 200;
        const og = c.createGain();
        og.gain.setValueAtTime(vol * 0.42, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        o.connect(og); og.connect(this.rhythmGain);
        o.start(t); o.stop(t + 0.08);
    }

    _bass(t, inf) {
        const c = this.ctx;
        const freqs = [55, 55, 73.42, 55, 65.41];
        const freq  = freqs[Math.floor(Math.random() * freqs.length)];
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = freq * (inf > 0.68 ? 1 + (Math.random() - 0.5) * 0.016 : 1);
        const flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 175 + inf * 360;
        const g = c.createGain();
        g.gain.setValueAtTime(0.27, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        o.connect(flt); flt.connect(g); g.connect(this.bassGain);
        o.start(t); o.stop(t + 0.18);
    }

    _glitchHit(t) {
        const n = this._noiseBuf(0.04 + Math.random() * 0.09);
        n.playbackRate.value = 0.4 + Math.random() * 1.6;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.13, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        n.connect(g); g.connect(this.chaosGain);
        n.start(t);
    }

    _arpNote(freq) {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = freq;
        const flt = this.ctx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 2300;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.065, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        o.connect(flt); flt.connect(g); g.connect(this.arpGain);
        o.start(t); o.stop(t + 0.21);
    }

    playCollect() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.setValueAtTime(660, t);
        o.frequency.exponentialRampToValueAtTime(1320, t + 0.07);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.21, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        o.connect(g); g.connect(this.masterGain);
        o.start(t); o.stop(t + 0.15);
    }

    playDeflect() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'square'; o.frequency.value = 220;
        o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(this.masterGain);
        o.start(t); o.stop(t + 0.12);
    }

    playSectorJump() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const whoosh = this._noiseBuf(0.55);
        const wf = this.ctx.createBiquadFilter();
        wf.type = 'bandpass'; wf.frequency.setValueAtTime(9500, t);
        wf.frequency.exponentialRampToValueAtTime(380, t + 0.48);
        const wg = this.ctx.createGain();
        wg.gain.setValueAtTime(0.3, t);
        wg.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
        whoosh.connect(wf); wf.connect(wg); wg.connect(this.masterGain);
        whoosh.start(t);
        [220, 277.18, 349.23, 415.30].forEach((f, i) => {
            const o  = this.ctx.createOscillator();
            o.type   = 'sawtooth'; o.frequency.value = f;
            const og = this.ctx.createGain();
            og.gain.setValueAtTime(0, t + i * 0.018);
            og.gain.linearRampToValueAtTime(0.1, t + i * 0.018 + 0.012);
            og.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
            o.connect(og); og.connect(this.masterGain);
            o.start(t + i * 0.018); o.stop(t + 0.78);
        });
    }

    playFlip() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(110, t + 0.22);
        const delay  = this.ctx.createDelay(0.35);
        delay.delayTime.value = 0.13;
        const fb = this.ctx.createGain(); fb.gain.value = 0.28;
        const g  = this.ctx.createGain();
        g.gain.setValueAtTime(0.24, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(g); o.connect(delay);
        delay.connect(fb); fb.connect(delay); fb.connect(g);
        g.connect(this.masterGain);
        o.start(t); o.stop(t + 0.45);
    }

    playGameOver() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const crash = this._noiseBuf(2.0);
        const cf = this.ctx.createBiquadFilter();
        cf.type = 'lowpass'; cf.frequency.setValueAtTime(22000, t);
        cf.frequency.exponentialRampToValueAtTime(120, t + 2.0);
        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.6, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        crash.connect(cf); cf.connect(cg); cg.connect(this.masterGain);
        crash.start(t);
        const o  = this.ctx.createOscillator();
        o.type  = 'sine'; o.frequency.setValueAtTime(440, t);
        o.frequency.exponentialRampToValueAtTime(26, t + 2.0);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.3, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        o.connect(og); og.connect(this.masterGain);
        o.start(t); o.stop(t + 2.05);
        this.masterGain.gain.linearRampToValueAtTime(0, t + 1.5);
    }

    _playStartup() {
        if (!this.ctx) return;
        const bips = [[440, 0], [554, 0.1], [659, 0.22], [880, 0.38]];
        bips.forEach(([freq, delay]) => {
            const t = this.ctx.currentTime + delay;
            const o = this.ctx.createOscillator();
            o.type = 'square'; o.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            o.connect(g); g.connect(this.masterGain);
            o.start(t); o.stop(t + 0.07);
        });
    }

    update(infectionLevel) {
        if (!this.ctx) return;
        const t   = this.ctx.currentTime;
        const inf = Math.max(0, Math.min(1, infectionLevel));
        this._inf  = inf;
        const ramp = 0.55;
        this.droneGain.gain.linearRampToValueAtTime(0.23 + inf * 0.13, t + ramp);
        this.bassGain.gain.linearRampToValueAtTime(Math.max(0, (inf - 0.18) * 0.58), t + ramp);
        this.rhythmGain.gain.linearRampToValueAtTime(Math.max(0, (inf - 0.11) * 0.92), t + ramp);
        this.chaosGain.gain.linearRampToValueAtTime(Math.max(0, (inf - 0.60) * 0.68), t + ramp);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.linearRampToValueAtTime(this.muted ? 0 : 0.78, this.ctx.currentTime + 0.12);
        }
        return this.muted;
    }
}