/**
 * ============================================================================
 * ORB AUDIO - Web Audio API Synthesizer for Orb 3D Experience
 * Pure client-side procedural sound design (zero audio asset dependencies)
 * ============================================================================
 */

export class OrbAudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ambientOsc = null;
        this.ambientGain = null;
        this.ambientFilter = null;
        this.isEnabled = true;
        this.ambientRunning = false;
        this.volume = 0.5;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.isEnabled = !muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isEnabled ? this.volume : 0, this.ctx.currentTime);
        }
        if (muted) {
            this.stopAmbientHum();
        } else {
            this.startAmbientHum();
        }
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.ctx && this.isEnabled) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    setMasterVolume(val) {
        this.setVolume(val);
    }

    startAmbientHum() {
        if (!this.isEnabled || this.ambientRunning) return;
        this.init();
        if (!this.ctx) return;
        this.resume();

        try {
            this.ambientOsc = this.ctx.createOscillator();
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            this.ambientFilter = this.ctx.createBiquadFilter();
            this.ambientGain = this.ctx.createGain();

            this.ambientOsc.type = 'sine';
            this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1 drone

            // LFO for subtle pulsing
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);
            lfoGain.gain.setValueAtTime(10, this.ctx.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(this.ambientOsc.frequency);

            // Low-pass filter for smooth warmth
            this.ambientFilter.type = 'lowpass';
            this.ambientFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

            this.ambientGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

            this.ambientOsc.connect(this.ambientFilter);
            this.ambientFilter.connect(this.ambientGain);
            this.ambientGain.connect(this.masterGain);

            this.ambientOsc.start();
            lfo.start();
            this.ambientRunning = true;
        } catch (e) {
            // Audio context policy
        }
    }

    stopAmbientHum() {
        if (!this.ambientRunning) return;
        try {
            if (this.ambientOsc) {
                this.ambientOsc.stop();
                this.ambientOsc.disconnect();
                this.ambientOsc = null;
            }
        } catch (e) { }
        this.ambientRunning = false;
    }

    // Orb Spawn: Radiant ascending chime
    playSpawn() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [440, 554.37, 659.25, 880]; // A major arpeggio
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + i * 0.05);

            g.gain.setValueAtTime(0.08, now + i * 0.05);
            g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.4);

            osc.connect(g);
            g.connect(this.masterGain);

            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.45);
        });
    }

    // Orb Collision: Crisp resonant glass/crystal ping
    playCollision(intensity = 1.0) {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'triangle';
        const baseFreq = 880 + Math.random() * 200;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.25);

        const gainVal = Math.min(0.18, 0.06 * intensity);
        g.gain.setValueAtTime(gainVal, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.35);
    }

    // Merge: Resonant sub-bass swell and harmonic fusion
    playMerge() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, now);
        osc1.frequency.exponentialRampToValueAtTime(220, now + 0.5);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(220, now);
        osc2.frequency.exponentialRampToValueAtTime(440, now + 0.5);

        g.gain.setValueAtTime(0.12, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.65);
        osc2.stop(now + 0.65);
    }

    // Split: Sparkling separation sweep
    playSplit() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.45);

        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.5);
    }

    // Zoom modulation
    modulateZoomPitch(distanceRatio) {
        if (!this.isEnabled || !this.ambientFilter || !this.ctx) return;
        const targetFreq = 180 + Math.min(600, distanceRatio * 350);
        this.ambientFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    // Dismiss: Energy dispersal whoosh
    playDismiss() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.48);
    }

    // Shape Morph: Ethereal morph chord
    playShapeMorph() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [329.63, 440, 523.25, 659.25]; // E minor / C major harmony
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now);

            g.gain.setValueAtTime(0.06, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

            osc.connect(g);
            g.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.65);
        });
    }

    // Grab sphere
    playGrab() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.08);

        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    // Throw sphere
    playThrow(speed = 1.0) {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        const startF = 300 + Math.min(500, speed * 120);
        osc.frequency.setValueAtTime(startF, now);
        osc.frequency.exponentialRampToValueAtTime(startF * 1.6, now + 0.18);

        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    // Celebration Chime (Academy or Achievement completion)
    playCelebrationChime() {
        if (!this.isEnabled) return;
        this.init();
        this.resume();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            g.gain.setValueAtTime(0, now + idx * 0.08);
            g.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.5);

            osc.connect(g);
            g.connect(this.masterGain);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.55);
        });
    }
}
