import { clamp } from '@/utils/math';

export class AudioManager {
  private context: AudioContext | null = null;
  private masterVolume = 0.7;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.masterVolume = clamp(master, 0, 1);
    this.musicVolume = clamp(music, 0, 1);
    this.sfxVolume = clamp(sfx, 0, 1);
  }

  playTone(frequency: number, duration = 0.08, type: OscillatorType = 'square', channel: 'music' | 'sfx' = 'sfx'): void {
    const ctx = this.ensureContext();
    const gain = ctx.createGain();
    const oscillator = ctx.createOscillator();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    const channelVolume = channel === 'music' ? this.musicVolume : this.sfxVolume;
    const volume = this.masterVolume * channelVolume;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }
}
