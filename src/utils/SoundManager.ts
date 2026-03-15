
class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        try {
            // Initialize on first interaction usually, but here we prepare
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.value = 0.3; // Default volume
            }
        } catch (e) {
            console.error("AudioContext not supported", e);
        }
    }

    toggle(enabled: boolean) {
        this.enabled = enabled;
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0) {
        if (!this.enabled || !this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.connect(this.masterGain);
        osc.connect(gain);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playClick() {
        this.playTone(800, 'sine', 0.1);
    }

    playBack() {
        this.playTone(600, 'triangle', 0.1);
    }

    playDamage() {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        // Noise buffer for damage
        const bufferSize = this.ctx.sampleRate * 0.2; // 0.2s
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();

        // Filter to make it sound like a hit
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        noise.start();
    }

    playFaint() {
        this.playTone(400, 'sawtooth', 0.1, 0);
        this.playTone(350, 'sawtooth', 0.1, 0.1);
        this.playTone(300, 'sawtooth', 0.3, 0.2);
    }

    playVictory() {
        const now = 0;
        this.playTone(523.25, 'square', 0.1, now);     // C5
        this.playTone(523.25, 'square', 0.1, now + 0.1);
        this.playTone(523.25, 'square', 0.1, now + 0.2);
        this.playTone(523.25, 'square', 0.3, now + 0.3);
        this.playTone(415.30, 'square', 0.3, now + 0.6); // G#4
        this.playTone(466.16, 'square', 0.3, now + 0.9); // Bb4
        this.playTone(523.25, 'square', 0.6, now + 1.2); // C5
    }
}

export const soundManager = new SoundManager();
