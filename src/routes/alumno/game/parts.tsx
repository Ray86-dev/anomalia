/** Piezas comunes de las pantallas de juego. */
import { ui } from '@shared/generated/content.ts';
import { checkWords, countWords, type WordCheck } from '@shared/game/words.ts';
import type { Counselor } from '@shared/schemas/content.ts';
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { audio } from '../../../engine/audio.ts';
import { loadInkLines, type InkLine } from '../../../engine/ink.ts';
import { fmt } from '../../../lib/text.ts';
import { Notice } from '../../../ui/Notice.tsx';
import { useGameContext } from './GameContext.ts';
import { drafts, initials } from './helpers.ts';

const t = ui.juego;
const subscribeAudio = (listener: () => void) => audio.subscribe(listener);
const isMuted = () => audio.isMuted();

/** Barra inferior con la acción principal y, si falla la red, el aviso con «Reintentar». */
export function ActionBar({ children }: { readonly children: ReactNode }) {
  const { error, retry } = useGameContext();
  return (
    <div className="action-bar">
      {error !== null && (
        <Notice tone="error">
          <span>{error}</span>{' '}
          <button className="link-button" type="button" onClick={retry}>
            {t.reintentar}
          </button>
        </Notice>
      )}
      {children}
    </div>
  );
}

/** Botón que envía «Continuar» desde la posición actual. */
export function AdvanceButton({ label }: { readonly label: string }) {
  const { run, act, pending } = useGameContext();
  return (
    <button
      className="btn"
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        void act({
          action: 'advance',
          from: { phase: run.phase, dilemmaId: run.currentDilemma },
        });
      }}
    >
      {pending ? t.guardando : label}
    </button>
  );
}

type InkReaderProps = {
  readonly storyId: string;
  readonly knot: string;
  /** Se llama al mostrar cada línea (0, 1, 2…): mueve el parallax del fondo. */
  readonly onStep?: (step: number) => void;
  readonly onDone: () => void;
};

/**
 * Narración de Mnemósine línea a línea, al ritmo del alumno (sin límite de tiempo, §10.3).
 * Las líneas leídas siguen visibles para poder releerlas.
 */
export function InkReader({ storyId, knot, onStep, onDone }: InkReaderProps) {
  const [lines, setLines] = useState<readonly InkLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(1);

  useEffect(() => {
    let active = true;
    loadInkLines(storyId, knot).then(
      (loaded) => {
        if (active) setLines(loaded);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [storyId, knot]);

  const total = lines?.length ?? 0;
  const finished = lines !== null && shown >= total;

  useEffect(() => {
    if (lines === null) return;
    onStep?.(shown - 1);
    if (shown >= lines.length) onDone();
    // onStep/onDone vienen de la pantalla padre y pueden cambiar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, lines]);

  if (failed) return <Notice tone="error">{ui.app.errorCarga}</Notice>;
  if (lines === null) return <p role="status">{ui.app.cargando}</p>;

  return (
    <div className="ink-reader">
      <div className="ink-lines" aria-live="polite">
        {lines.slice(0, shown).map((line, index) => (
          <p key={index} className={`ink-line ${line.tags.map((tag) => `ink-${tag}`).join(' ')}`}>
            {line.text}
          </p>
        ))}
      </div>
      {!finished && (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setShown((n) => Math.min(n + 1, total));
          }}
        >
          {t.siguiente}
        </button>
      )}
    </div>
  );
}

export function Avatar({ counselor }: { readonly counselor: Counselor }) {
  return (
    <span className="avatar" style={{ backgroundColor: counselor.color }} aria-hidden="true">
      {initials(counselor.nombre)}
    </span>
  );
}

type TextAnswerProps = {
  readonly label: string;
  readonly help: string;
  readonly draftKey: string;
  readonly range: readonly [number, number];
  readonly maxChars: number;
  readonly submitLabel: string;
  /** Texto del botón mientras el servidor (y la IA, hasta 6 s) procesa el envío. */
  readonly pendingLabel: string;
  /**
   * `true` si el servidor guardó el texto (se borra el borrador); un texto si hay que pedir
   * algo al alumno sin perder lo escrito (p. ej., la IA no encuentra razones); `false` si falló.
   */
  readonly onSubmit: (text: string) => Promise<boolean | string>;
};

/**
 * Texto libre del alumno con contador de palabras. El aviso de «corto» o «largo» se puede
 * saltar con un segundo envío: el juego nunca bloquea definitivamente (§7.2).
 */
export function TextAnswer({
  label,
  help,
  draftKey,
  range,
  maxChars,
  submitLabel,
  pendingLabel,
  onSubmit,
}: TextAnswerProps) {
  const id = useId();
  const { pending } = useGameContext();
  const [text, setText] = useState(() => drafts.read(draftKey));
  const [warned, setWarned] = useState<WordCheck | null>(null);
  const [request, setRequest] = useState<string | null>(null);
  const words = countWords(text);
  const check = checkWords(text, range);
  const [min, max] = range;

  const warning =
    warned === 'empty'
      ? t.justificacion.vacio
      : warned === 'short'
        ? fmt(t.justificacion.corto, { min })
        : warned === 'long'
          ? fmt(t.justificacion.largo, { max })
          : null;

  async function submit() {
    if (check === 'empty' || (check !== 'ok' && warned !== check)) {
      setWarned(check);
      return;
    }
    const result = await onSubmit(text);
    if (result === true) drafts.write(draftKey, '');
    setRequest(typeof result === 'string' ? result : null);
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          className="answer-box"
          value={text}
          maxLength={maxChars}
          rows={6}
          aria-describedby={`${id}-help ${id}-count`}
          onChange={(event) => {
            setText(event.target.value);
            drafts.write(draftKey, event.target.value);
            setWarned(null);
            setRequest(null);
          }}
        />
        <p id={`${id}-help`} className="help">
          {help} {t.justificacion.borrador}
        </p>
        <p id={`${id}-count`} className={`word-count word-count-${check}`} aria-live="polite">
          {fmt(t.justificacion.contador, { n: words })}
        </p>
      </div>
      <ActionBar>
        {warning !== null && <Notice tone="error">{warning}</Notice>}
        {request !== null && <Notice tone="error">{request}</Notice>}
        <button className="btn" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </ActionBar>
    </form>
  );
}

/** Botón de silencio, siempre accesible (§10.2). */
export function AudioToggle() {
  const muted = useSyncExternalStore(subscribeAudio, isMuted);
  return (
    <button
      className="icon-button"
      type="button"
      aria-pressed={muted}
      aria-label={muted ? t.audio.activar : t.audio.silenciar}
      onClick={() => {
        audio.setMuted(!muted);
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
