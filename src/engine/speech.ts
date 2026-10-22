/**
 * Lectura en voz alta (§10.3, M7) con la Web Speech API: las voces del propio móvil, sin
 * servidor ni coste. Solo lee textos del juego (contenido, objeciones y cierres), nunca los
 * que escribe el alumno. Si el navegador no tiene voces, la opción no aparece.
 */
const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let voice: SpeechSynthesisVoice | null = null;
let speaking = false;
/** Cada lectura nueva invalida los avisos de la anterior (cancelarla también los dispara). */
let generation = 0;
let onSpeaking: ((value: boolean) => void) | null = null;

/** Castellano de España si lo hay (mejor una voz del propio móvil), si no, otro castellano. */
function pickVoice(): void {
  if (synth === null) return;
  const voices = synth.getVoices();
  voice =
    voices.find((v) => v.lang === 'es-ES' && v.localService) ??
    voices.find((v) => v.lang === 'es-ES') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    null;
}

if (synth !== null) {
  pickVoice();
  synth.addEventListener('voiceschanged', pickVoice);
}

function setSpeaking(value: boolean): void {
  if (speaking === value) return;
  speaking = value;
  onSpeaking?.(value);
}

/** Frases cortas: algunos navegadores cortan las locuciones largas a los 15 segundos. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]*["»”)]*\s*/gu) ?? [])
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\p{N}]/u.test(part));
}

export const speech = {
  supported: synth !== null,

  /** Lee el texto desde el principio (corta lo que se estuviera leyendo). */
  speak(text: string): void {
    if (synth === null) return;
    synth.cancel();
    const mine = ++generation;
    const parts = sentences(text);
    const done = () => {
      if (mine === generation) setSpeaking(false);
    };
    parts.forEach((part, i) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang ?? 'es-ES';
      if (voice !== null) utterance.voice = voice;
      utterance.rate = 0.95;
      if (i === 0) {
        utterance.onstart = () => {
          if (mine === generation) setSpeaking(true);
        };
      }
      if (i === parts.length - 1) {
        utterance.onend = done;
        utterance.onerror = done;
      }
      synth.speak(utterance);
    });
  },

  stop(): void {
    generation += 1;
    synth?.cancel();
    setSpeaking(false);
  },

  /** Avisa al empezar y al terminar de leer (para bajar la música mientras tanto). */
  onSpeakingChange(listener: ((value: boolean) => void) | null): void {
    onSpeaking = listener;
  },
};
