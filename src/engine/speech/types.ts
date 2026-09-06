export type SpeechState = 'idle' | 'starting' | 'listening' | 'error';

/**
 * Adapter-Schnittstelle für die Spracherkennung.
 *
 * Genau diese Grenze macht den späteren Wechsel schmerzfrei:
 * heute Web Speech API, morgen Vosk-WASM (offline), im React-Native-Port
 * der systemeigene Erkenner. Aligner und UI merken davon nichts.
 */
export interface SpeechSource {
  /** Steht die Erkennung auf diesem Gerät überhaupt zur Verfügung? */
  readonly available: boolean;
  /** Läuft komplett auf dem Gerät (dann verlassen keine Daten das Handy)? */
  readonly onDevice: boolean;
  start(): void;
  stop(): void;
  /** Wird laufend mit den zuletzt verstandenen, normalisierten Wörtern gerufen. */
  onHypothesis: ((tokens: string[], final: boolean) => void) | null;
  onState: ((state: SpeechState, message?: string) => void) | null;
}
