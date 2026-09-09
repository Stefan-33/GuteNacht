import type { Ctx, OneShot } from '../synth';
import { voice } from '../voice';

/**
 * Alles, was eine Stimme hat - Tiere wie Menschen. Alle über dieselbe
 * Formant-Synthese aus voice.ts.
 *
 * Die Zahlenwerte sind an Messwerte echter Tierstimmen angelehnt:
 * Grundtonlage, Formantpositionen und Dauer stammen aus der Bioakustik.
 * Verifiziert werden sie von test/render-sounds.mjs, das jeden Klang
 * offline rendert und den Tonhöhenverlauf gegen den erwarteten Bereich prüft.
 */

/* ---------------- Bauernhof ---------------------------------------- */

/** Eselschrei. Die Rauheit über `sub` ist das Erkennungsmerkmal. */
function bray(ctx: Ctx, dest: AudioNode, t: number, scale: number): number {
  const d = 1.05 * scale;
  return voice(ctx, dest, t, {
    duration: d,
    f0: [
      [0, 200], [0.06 * scale, 300], [0.30 * scale, 345],
      [0.36 * scale, 330], [0.45 * scale, 240], [d, 95],
    ],
    formants: [
      { f: [[0, 540], [0.32 * scale, 620], [0.5 * scale, 560], [d, 430]], q: 7, gain: 1 },
      { f: [[0, 1750], [0.30 * scale, 2050], [0.5 * scale, 1500], [d, 1080]], q: 9, gain: 0.55 },
      { f: [[0, 2800], [d, 2450]], q: 10, gain: 0.2 },
    ],
    amp: [
      [0, 0], [0.035, 0.9], [0.30 * scale, 0.85], [0.38 * scale, 1],
      [0.85 * scale, 0.6], [d, 0],
    ],
    jitter: 18, breath: 0.12, sub: 0.5, drive: 0.55,
    // Gemessen: mit 3200 lag der Schwerpunkt bei 1759 Hz - viel zu hell.
    // Ein Esel ist ein Brustkorb, kein Vogel.
    tilt: 2600,
  });
}

export const esel: OneShot = (ctx, dest, t) => {
  bray(ctx, dest, t, 1);
  bray(ctx, dest, t + 1.2, 0.82);
  return 2.15;
};

/** Einzelnes Bellen. Kurz, harter Einsatz, Tonhöhe fällt sofort ab. */
function woof(ctx: Ctx, dest: AudioNode, t: number, pitch: number): void {
  voice(ctx, dest, t, {
    duration: 0.17,
    f0: [[0, pitch], [0.05, pitch * 0.8], [0.17, pitch * 0.32]],
    formants: [
      { f: [[0, 520], [0.17, 420]], q: 5, gain: 1 },
      { f: [[0, 1250], [0.17, 1050]], q: 6, gain: 0.8 },
      { f: [[0, 2400], [0.17, 2200]], q: 7, gain: 0.45 },
    ],
    amp: [[0, 0], [0.008, 1], [0.05, 0.55], [0.17, 0]],
    jitter: 12, breath: 0.3, sub: 0.25, drive: 0.6, tilt: 4200,
  });
}

export const hundBellen: OneShot = (ctx, dest, t) => {
  woof(ctx, dest, t, 470);
  woof(ctx, dest, t + 0.28, 430);
  return 0.55;
};

/** Geheul. Im Gegensatz zum Bellen tonal - also kaum Jitter, kaum Rauheit. */
export const hundJaulen: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.8,
  f0: [[0, 240], [0.35, 400], [1.1, 415], [1.8, 270]],
  formants: [
    { f: [[0, 450], [1.8, 420]], q: 8, gain: 1 },
    { f: [[0, 1150], [0.6, 1250], [1.8, 1050]], q: 9, gain: 0.6 },
    { f: [[0, 2500], [1.8, 2400]], q: 9, gain: 0.25 },
  ],
  amp: [[0, 0], [0.2, 0.65], [1.3, 0.6], [1.8, 0]],
  jitter: 5, breath: 0.08, sub: 0.12, drive: 0.2, tilt: 3000,
});

/** Miau. Der Charakter steckt in der Formantwanderung von "e" über "a" nach "u". */
export const katzeMiau: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 0.85,
  f0: [[0, 480], [0.15, 760], [0.45, 700], [0.85, 380]],
  formants: [
    { f: [[0, 850], [0.18, 1100], [0.85, 750]], q: 8, gain: 1 },
    { f: [[0, 1900], [0.2, 2250], [0.85, 1700]], q: 9, gain: 0.7 },
    { f: [[0, 3200], [0.85, 3000]], q: 8, gain: 0.3 },
  ],
  amp: [[0, 0], [0.06, 0.75], [0.5, 0.65], [0.85, 0]],
  jitter: 9, breath: 0.18, sub: 0.15, drive: 0.3, tilt: 4000,
});

/** Hahnenschrei, vier Silben. Die dritte ist die längste - daran erkennt man ihn. */
export const hahnKikeriki: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.25,
  f0: [
    [0, 620], [0.10, 640], [0.13, 780], [0.26, 800],
    [0.30, 880], [0.55, 860], [0.60, 700], [1.25, 430],
  ],
  formants: [
    { f: [[0, 700], [0.3, 780], [1.25, 620]], q: 6, gain: 1 },
    { f: [[0, 1900], [0.3, 2100], [1.25, 1600]], q: 8, gain: 0.8 },
    { f: [[0, 3100], [1.25, 2800]], q: 9, gain: 0.4 },
  ],
  amp: [
    [0, 0], [0.02, 0.8], [0.10, 0.5], [0.13, 0.85], [0.25, 0.55],
    [0.30, 1], [0.55, 0.8], [0.62, 0.7], [1.25, 0],
  ],
  jitter: 20, breath: 0.25, sub: 0.35, drive: 0.7, tilt: 4500,
});

/** Grunzen. Kurz, tief, sehr rau - fast mehr Geräusch als Ton. */
function grunt(ctx: Ctx, dest: AudioNode, t: number, pitch: number): void {
  voice(ctx, dest, t, {
    duration: 0.22,
    f0: [[0, pitch], [0.08, pitch * 0.9], [0.22, pitch * 0.6]],
    formants: [
      { f: [[0, 480], [0.22, 420]], q: 4, gain: 1 },
      { f: [[0, 1150], [0.22, 950]], q: 5, gain: 0.6 },
    ],
    amp: [[0, 0], [0.02, 0.9], [0.12, 0.6], [0.22, 0]],
    jitter: 22, breath: 0.45, sub: 0.55, drive: 0.5, tilt: 2200,
  });
}

export const schweinGrunz: OneShot = (ctx, dest, t) => {
  grunt(ctx, dest, t, 260);
  grunt(ctx, dest, t + 0.3, 230);
  grunt(ctx, dest, t + 0.55, 280);
  return 0.85;
};

/** Muhen. Tief und lang, mit dem typischen Bogen nach oben und zurück. */
export const kuhMuh: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.5,
  f0: [[0, 130], [0.25, 175], [0.9, 168], [1.5, 110]],
  formants: [
    { f: [[0, 400], [0.3, 460], [1.5, 380]], q: 6, gain: 1 },
    { f: [[0, 980], [0.4, 1100], [1.5, 880]], q: 7, gain: 0.65 },
    { f: [[0, 2000], [1.5, 1850]], q: 8, gain: 0.25 },
  ],
  amp: [[0, 0], [0.12, 0.8], [1.0, 0.7], [1.5, 0]],
  jitter: 8, breath: 0.2, sub: 0.3, drive: 0.35, tilt: 2400,
});

/**
 * Blöken. Das Tremolo ist hier alles: Ein Schaf meckert etwa zwölfmal
 * pro Sekunde. Ohne dieses Zittern bleibt nur ein gehaltener Ton.
 */
export const schafMaeh: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 0.95,
  f0: [[0, 300], [0.12, 340], [0.6, 320], [0.95, 240]],
  formants: [
    { f: [[0, 780], [0.2, 900], [0.95, 700]], q: 7, gain: 1 },
    { f: [[0, 1850], [0.3, 2000], [0.95, 1650]], q: 8, gain: 0.7 },
    { f: [[0, 2900], [0.95, 2700]], q: 8, gain: 0.3 },
  ],
  amp: [[0, 0], [0.05, 0.75], [0.7, 0.65], [0.95, 0]],
  jitter: 14, breath: 0.22, sub: 0.2, drive: 0.4, tilt: 3600,
  tremolo: [12, 0.32],
});

/* ---------------- Wild und Fantasie -------------------------------- */

/** Mäusepiepsen. Sehr hoch und sehr kurz - Mäuse rufen bei mehreren Kilohertz. */
function squeak(ctx: Ctx, dest: AudioNode, t: number, pitch: number): void {
  voice(ctx, dest, t, {
    duration: 0.13,
    f0: [[0, pitch], [0.05, pitch * 1.25], [0.13, pitch * 0.9]],
    formants: [
      { f: [[0, 3600], [0.13, 3300]], q: 9, gain: 1 },
      { f: [[0, 5200], [0.13, 4800]], q: 10, gain: 0.5 },
    ],
    amp: [[0, 0], [0.012, 0.8], [0.13, 0]],
    jitter: 40, breath: 0.15, drive: 0.2, tilt: 8000,
  });
}

export const mausPiep: OneShot = (ctx, dest, t) => {
  squeak(ctx, dest, t, 2900);
  squeak(ctx, dest, t + 0.17, 3200);
  squeak(ctx, dest, t + 0.31, 2750);
  return 0.5;
};

/** Löwengebrüll. Der Grundton liegt erstaunlich tief - unter hundert Hertz. */
export const loeweBruell: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 2.2,
  f0: [[0, 75], [0.3, 105], [1.4, 95], [2.2, 55]],
  formants: [
    { f: [[0, 320], [0.4, 380], [2.2, 280]], q: 5, gain: 1 },
    { f: [[0, 780], [0.5, 900], [2.2, 700]], q: 6, gain: 0.7 },
    { f: [[0, 1700], [2.2, 1500]], q: 7, gain: 0.3 },
  ],
  amp: [[0, 0], [0.15, 0.85], [1.5, 0.75], [2.2, 0]],
  jitter: 10, breath: 0.3, sub: 0.6, drive: 0.75, tilt: 2000,
});

/** Drachenbrummen. Frei erfunden - wie ein Löwe, nur größer und langsamer. */
export const dracheBrumm: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 2.6,
  f0: [[0, 62], [0.4, 88], [1.8, 80], [2.6, 48]],
  formants: [
    { f: [[0, 260], [0.5, 330], [2.6, 220]], q: 4, gain: 1 },
    { f: [[0, 640], [0.6, 780], [2.6, 560]], q: 6, gain: 0.75 },
    { f: [[0, 1400], [2.6, 1200]], q: 7, gain: 0.35 },
  ],
  amp: [[0, 0], [0.2, 0.8], [1.9, 0.7], [2.6, 0]],
  jitter: 14, breath: 0.35, sub: 0.7, drive: 0.8, tilt: 1800,
});

/** Eulenruf, zwei Silben. Fast reiner Ton - Eulen rufen sehr sauber. */
export const euleRuf: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 2; i++) {
    voice(ctx, dest, t + i * 0.6, {
      duration: 0.45,
      f0: [[0, 400], [0.1, 380], [0.45, 360]],
      formants: [
        { f: [[0, 420], [0.45, 390]], q: 12, gain: 1 },
        { f: [[0, 1150], [0.45, 1050]], q: 10, gain: 0.2 },
      ],
      amp: [[0, 0], [0.1, 0.6], [0.3, 0.55], [0.45, 0]],
      jitter: 4, breath: 0.06, drive: 0.1, tilt: 1600,
    });
  }
  return 1.1;
};

/** Möwenschrei. Hell, scharf, mehrfach - Küstengeräusch schlechthin. */
export const moewe: OneShot = (ctx, dest, t) => {
  const times = [0, 0.42, 0.78, 1.3];
  times.forEach((dt, i) => {
    voice(ctx, dest, t + dt, {
      duration: 0.35,
      f0: [[0, 900 - i * 40], [0.08, 1150 - i * 40], [0.35, 720 - i * 30]],
      formants: [
        { f: [[0, 1250], [0.1, 1500], [0.35, 1100]], q: 8, gain: 1 },
        { f: [[0, 2700], [0.35, 2400]], q: 9, gain: 0.6 },
        { f: [[0, 4200], [0.35, 3900]], q: 9, gain: 0.25 },
      ],
      amp: [[0, 0], [0.03, 0.8], [0.2, 0.5], [0.35, 0]],
      jitter: 28, breath: 0.3, sub: 0.2, drive: 0.55, tilt: 6000,
    });
  });
  return 1.7;
};

/** Walgesang. Sehr tief, sehr lang, sehr tonal - ein einziger langer Bogen. */
export const walRuf: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 3.2,
  f0: [[0, 70], [0.8, 170], [2.0, 160], [3.2, 65]],
  formants: [
    { f: [[0, 240], [1.0, 400], [3.2, 210]], q: 10, gain: 1 },
    { f: [[0, 620], [1.2, 900], [3.2, 540]], q: 11, gain: 0.5 },
  ],
  amp: [[0, 0], [0.5, 0.7], [2.4, 0.6], [3.2, 0]],
  jitter: 3, breath: 0.05, sub: 0.25, drive: 0.15, tilt: 1400,
});

/* ---------------- Menschliche Laute -------------------------------- */

/** Gähnen. Langsam auf, Formanten wandern weit auseinander, dann Seufzer. */
export const gaehnen: OneShot = (ctx, dest, t) => voice(ctx, dest, t, {
  duration: 1.9,
  f0: [[0, 175], [0.5, 210], [1.1, 195], [1.9, 130]],
  formants: [
    { f: [[0, 620], [0.7, 780], [1.9, 500]], q: 5, gain: 1 },
    { f: [[0, 1100], [0.7, 1350], [1.9, 950]], q: 6, gain: 0.65 },
    { f: [[0, 2600], [1.9, 2400]], q: 7, gain: 0.2 },
  ],
  amp: [[0, 0], [0.4, 0.6], [1.2, 0.55], [1.9, 0]],
  jitter: 7, breath: 0.55, sub: 0.15, drive: 0.2, tilt: 2800,
});

/** Ächzen beim Ziehen. Angestrengt, gepresst, kurz. */
export const hauRuck: OneShot = (ctx, dest, t) => {
  voice(ctx, dest, t, {
    duration: 0.5,
    f0: [[0, 150], [0.15, 185], [0.5, 140]],
    formants: [
      { f: [[0, 560], [0.5, 480]], q: 6, gain: 1 },
      { f: [[0, 1150], [0.5, 980]], q: 7, gain: 0.6 },
    ],
    amp: [[0, 0], [0.08, 0.7], [0.35, 0.6], [0.5, 0]],
    jitter: 16, breath: 0.4, sub: 0.4, drive: 0.5, tilt: 2400,
  });
  voice(ctx, dest, t + 0.62, {
    duration: 0.75,
    f0: [[0, 175], [0.2, 215], [0.75, 120]],
    formants: [
      { f: [[0, 640], [0.75, 460]], q: 6, gain: 1 },
      { f: [[0, 1250], [0.75, 900]], q: 7, gain: 0.6 },
    ],
    amp: [[0, 0], [0.06, 0.85], [0.5, 0.7], [0.75, 0]],
    jitter: 20, breath: 0.45, sub: 0.45, drive: 0.6, tilt: 2400,
  });
  return 1.4;
};

/** Schluckauf. Zwei Hickser - scharf ein, sofort abgeschnitten. */
export const schluckauf: OneShot = (ctx, dest, t) => {
  for (let i = 0; i < 2; i++) {
    voice(ctx, dest, t + i * 0.85, {
      duration: 0.2,
      f0: [[0, 230], [0.05, 340], [0.2, 180]],
      // "Hicks" ist ein i-Laut: erster Formant tief, zweiter weit oben.
      // Vorher standen die Werte auf einem offenen a, gemessen kam der
      // Klang deshalb fast eine Oktave zu hoch heraus.
      formants: [
        { f: [[0, 340], [0.06, 430], [0.2, 300]], q: 8, gain: 1 },
        { f: [[0, 2100], [0.06, 2450], [0.2, 1900]], q: 9, gain: 0.55 },
        { f: [[0, 3100], [0.2, 2900]], q: 9, gain: 0.2 },
      ],
      amp: [[0, 0], [0.015, 0.9], [0.07, 0.35], [0.2, 0]],
      jitter: 18, breath: 0.35, sub: 0.2, drive: 0.45, tilt: 3200,
    });
  }
  return 1.15;
};
