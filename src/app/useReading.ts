import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../engine/audio';
import { ReadingSession } from '../engine/session';
import { WebSpeechSource } from '../engine/speech/webSpeech';
import type { SpeechSource, SpeechState } from '../engine/speech/types';
import type { Story } from '../engine/types';

interface WakeLockish {
  request(type: 'screen'): Promise<{ release(): Promise<void> }>;
}

/**
 * Bindeglied zwischen Engine und React.
 *
 * Bewusst wenig State: die Spracherkennung feuert mehrmals pro Sekunde,
 * aber neu gerendert wird nur, wenn sich die Leseposition tatsächlich
 * bewegt hat. Sonst rendert der Text sich im Sekundentakt kaputt.
 */
export function useReading(story: Story | null) {
  const audio = useMemo(() => new AudioEngine(), []);
  const speech = useMemo<SpeechSource>(() => new WebSpeechSource(), []);
  const sessionRef = useRef<ReadingSession | null>(null);
  const wakeLockRef = useRef<{ release(): Promise<void> } | null>(null);
  const speakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [position, setPosition] = useState(0);
  const [status, setStatus] = useState<SpeechState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  /*
   * Drei Stufen statt eines stufenlosen Reglers: Wer abends mit einem
   * müden Kind auf dem Arm ein Handy bedient, trifft keinen Schieberegler.
   */
  const [musicLevel, setMusicLevelState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sternstunde.musik');
      return saved === null ? 1 : Number(saved);
    } catch {
      return 1;
    }
  });

  // Session neu aufsetzen, wenn eine andere Geschichte geladen wird.
  useEffect(() => {
    if (!story) {
      sessionRef.current = null;
      return;
    }
    const session = new ReadingSession(story, audio);
    session.onUpdate = (u) => {
      setPosition(u.position);
      setConfidence(u.confidence);
    };
    sessionRef.current = session;
    setPosition(0);
    return () => {
      session.stop();
      sessionRef.current = null;
    };
  }, [story, audio]);

  // Sprachquelle verdrahten.
  useEffect(() => {
    speech.onHypothesis = (tokens) => {
      sessionRef.current?.feed(tokens);

      // Solange Wörter hereinkommen, wird gesprochen - dann geht die Musik
      // zurück. Erst nach anderthalb Sekunden Stille kommt sie wieder hoch,
      // sonst pumpt sie in jeder Atempause.
      audio.duckMusic(true);
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
      speakingTimer.current = setTimeout(() => audio.duckMusic(false), 1500);
    };
    speech.onState = (s, msg) => {
      setStatus(s);
      setMessage(msg ?? null);
    };
    return () => {
      speech.onHypothesis = null;
      speech.onState = null;
      speech.stop();
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    };
  }, [speech, audio]);

  // Audio-Kontext beim Verlassen abbauen, sonst läuft der Wald weiter.
  useEffect(() => () => audio.dispose(), [audio]);

  const MUSIC_STEPS = [0, 0.045, 0.085];

  const setMusicLevel = useCallback((step: number) => {
    setMusicLevelState(step);
    audio.setMusicVolume(MUSIC_STEPS[step] ?? 0.085);
    try {
      localStorage.setItem('sternstunde.musik', String(step));
    } catch {
      /* Ohne Merken geht es auch. */
    }
  }, [audio]);

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(async () => {
    // Muss synchron aus der Nutzergeste heraus passieren, sonst bleibt
    // der AudioContext auf Android stumm.
    await audio.unlock();
    // Musik passend zur Geschichte - siehe MOODS in music.ts.
    audio.setMusicVolume(MUSIC_STEPS[musicLevel] ?? 0.085);
    if (story && musicLevel > 0) audio.startMusic(story.music);
    speech.start();

    // Bildschirm anlassen - sonst ist nach 30 Sekunden dunkel und
    // mitten in der Geschichte muss jemand das Handy anfassen.
    try {
      const wl = (navigator as unknown as { wakeLock?: WakeLockish }).wakeLock;
      if (wl) wakeLockRef.current = await wl.request('screen');
    } catch {
      /* Ohne Wake Lock geht es auch, nur unbequemer. */
    }
  }, [audio, speech, story, musicLevel]);

  const pause = useCallback(() => {
    speech.stop();
    audio.stopMusic();
    releaseWakeLock();
  }, [speech, audio, releaseWakeLock]);

  const restart = useCallback(() => {
    sessionRef.current?.reset();
    setPosition(0);
  }, []);

  const jumpTo = useCallback((token: number) => {
    sessionRef.current?.jumpTo(token);
  }, []);

  // Wake Lock geht verloren, wenn die App in den Hintergrund wandert.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'listening' && !wakeLockRef.current) {
        void start();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status, start]);

  useEffect(() => releaseWakeLock, [releaseWakeLock]);

  const total = story?.tokens.length ?? 0;

  return {
    position,
    total,
    progress: total === 0 ? 0 : position / total,
    status,
    message,
    confidence,
    micAvailable: speech.available,
    musicLevel,
    setMusicLevel,
    start,
    pause,
    restart,
    jumpTo,
  };
}
