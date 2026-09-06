import { AMB, SFX } from './sounds';

/**
 * Audio-Fassade: zwei Busse (Atmosphäre und Effekte), ein Master.
 *
 * Ducking: sobald ein Effekt spielt, geht die Atmosphäre kurz zurück.
 * Ohne das matscht ein Waldrauschen jeden Eselschrei zu.
 *
 * Fallstrick Android/Chrome: der AudioContext startet suspendiert und darf
 * erst nach einer echten Nutzergeste laufen. Deshalb `unlock()`, das aus
 * dem Klick auf "Vorlesen starten" heraus aufgerufen wird.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private running = new Map<string, () => void>();
  private duckUntil = 0;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Muss aus einem Klick-Handler heraus aufgerufen werden. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = 1;
      this.ambBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  /** Atmosphäre zurücknehmen, solange ein Effekt läuft. */
  private duck(seconds: number): void {
    if (!this.ctx || !this.ambBus) return;
    const now = this.ctx.currentTime;
    const until = now + seconds + 0.4;
    if (until <= this.duckUntil) return;
    this.duckUntil = until;
    const g = this.ambBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.35, now + 0.12);
    g.linearRampToValueAtTime(1, until);
  }

  playSfx(name: string, gain = 1): void {
    if (!this.ctx || !this.sfxBus) return;
    const recipe = SFX[name];
    if (!recipe) {
      console.warn(`[audio] Unbekannter Effekt: ${name}`);
      return;
    }
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.sfxBus);
    const dur = recipe(this.ctx, g, this.ctx.currentTime + 0.02);
    this.duck(dur);
    // Aufräumen, sobald der Effekt sicher verklungen ist.
    setTimeout(() => g.disconnect(), (dur + 1) * 1000);
  }

  startAmbient(name: string, gain = 0.5): void {
    if (!this.ctx || !this.ambBus) return;
    if (this.running.has(name)) return;
    const recipe = AMB[name];
    if (!recipe) {
      console.warn(`[audio] Unbekannte Atmosphäre: ${name}`);
      return;
    }
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.ambBus);
    const stop = recipe(this.ctx, g);
    this.running.set(name, () => {
      stop();
      setTimeout(() => g.disconnect(), 1500);
    });
  }

  stopAmbient(name: string): void {
    const stop = this.running.get(name);
    if (stop) {
      stop();
      this.running.delete(name);
    }
  }

  stopAllAmbient(): void {
    for (const name of [...this.running.keys()]) this.stopAmbient(name);
  }

  /** Beim Verlassen des Lese-Screens. */
  dispose(): void {
    this.stopAllAmbient();
    if (this.ctx) {
      const ctx = this.ctx;
      setTimeout(() => { void ctx.close(); }, 1500);
      this.ctx = null;
      this.master = null;
      this.ambBus = null;
      this.sfxBus = null;
    }
  }
}
