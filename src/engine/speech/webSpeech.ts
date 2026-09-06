import { tokenize } from '../tokenize';
import type { SpeechSource, SpeechState } from './types';

/* Die Web Speech API ist nicht in den TS-DOM-Typen, deshalb das Nötigste selbst. */
interface SRAlternative { transcript: string }
interface SRResult { readonly length: number; isFinal: boolean; [i: number]: SRAlternative }
interface SRResultList { readonly length: number; [i: number]: SRResult }
interface SREvent extends Event { resultIndex: number; results: SRResultList }
interface SRErrorEvent extends Event { error: string; message?: string }
interface SRInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SRCtor = new () => SRInstance;

function getCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Web Speech API als Sprachquelle.
 *
 * Der eigentliche Aufwand hier ist NICHT die Erkennung, sondern das
 * Am-Leben-Halten: Chrome auf Android beendet die Sitzung eigenmächtig -
 * nach kurzer Stille, spätestens nach ungefähr einer Minute. `continuous`
 * wird dort gerne ignoriert. Ohne den Neustart-Loop unten reißt mitten in
 * der Geschichte der Ton ab.
 *
 * Der Preis: das Audio geht zur Erkennung an Google. Für die eigene
 * Familie vertretbar, aber der Grund, warum hier später Vosk hingehört.
 */
export class WebSpeechSource implements SpeechSource {
  private rec: SRInstance | null = null;
  private wantRunning = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restarts: number[] = [];

  onHypothesis: ((tokens: string[], final: boolean) => void) | null = null;
  onState: ((state: SpeechState, message?: string) => void) | null = null;

  readonly available = getCtor() !== null;
  readonly onDevice = false;

  private emit(state: SpeechState, message?: string): void {
    this.onState?.(state, message);
  }

  start(): void {
    if (!this.available) {
      this.emit('error', 'Dieser Browser kann keine Spracherkennung. Nimm Chrome auf Android.');
      return;
    }
    this.wantRunning = true;
    this.restarts = [];
    this.emit('starting');
    this.spawn();
  }

  stop(): void {
    this.wantRunning = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.rec) {
      this.rec.onend = null;
      this.rec.onerror = null;
      this.rec.onresult = null;
      try { this.rec.abort(); } catch { /* war nie gestartet */ }
      this.rec = null;
    }
    this.emit('idle');
  }

  private spawn(): void {
    const Ctor = getCtor();
    if (!Ctor || !this.wantRunning) return;

    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.emit('listening');

    rec.onresult = (e: SREvent) => {
      const results = e.results;
      if (results.length === 0) return;
      // Nur die aktuelle Äußerung interessiert - der Aligner braucht die
      // letzten Wörter, nicht das gesamte bisherige Transkript.
      const last = results[results.length - 1];
      const text = last[0]?.transcript ?? '';
      const tokens = tokenize(text);
      if (tokens.length > 0) this.onHypothesis?.(tokens, last.isFinal);
    };

    rec.onerror = (e: SRErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.wantRunning = false;
        this.emit('error', 'Kein Zugriff aufs Mikrofon. In den Browser-Einstellungen erlauben.');
        return;
      }
      // no-speech, aborted, audio-capture, network: alles Alltag, weiterlaufen.
      if (e.error === 'network') {
        this.emit('error', 'Keine Verbindung zur Spracherkennung.');
      }
    };

    rec.onend = () => {
      if (!this.wantRunning) return;
      // Neustart, aber mit Notbremse gegen Endlosschleifen.
      const now = Date.now();
      this.restarts = this.restarts.filter((t) => now - t < 10000);
      this.restarts.push(now);
      if (this.restarts.length > 12) {
        this.wantRunning = false;
        this.emit('error', 'Die Spracherkennung bricht dauernd ab. Tippe zum Weiterlesen auf ein Wort.');
        return;
      }
      const delay = this.restarts.length > 6 ? 700 : 200;
      this.restartTimer = setTimeout(() => this.spawn(), delay);
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // Kommt vor, wenn die alte Instanz noch nicht ganz tot ist.
      this.restartTimer = setTimeout(() => this.spawn(), 400);
    }
  }
}
