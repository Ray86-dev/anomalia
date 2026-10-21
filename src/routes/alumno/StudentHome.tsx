import { blockedTerms, ui } from '@shared/generated/content.ts';
import { aliasProblem, cleanAlias } from '@shared/game/alias.ts';
import type { MyState } from '@shared/schemas/state.ts';
import { isAuthApiError } from '@supabase/supabase-js';
import { useEffect, useState, type SubmitEvent } from 'react';
import { joinClass, loadMyRecovery, loadMyState, recoverPlayer } from '../../lib/api.ts';
import { getClient } from '../../lib/supabase.ts';
import { fmt } from '../../lib/text.ts';
import { Field } from '../../ui/Field.tsx';
import { Notice } from '../../ui/Notice.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Game } from './game/Game.tsx';

type View =
  | { kind: 'loading' }
  | { kind: 'join' }
  | { kind: 'recover' }
  /** Recuperación pendiente de que la apruebe el docente. */
  | { kind: 'waiting'; alias: string; rejected: boolean }
  | { kind: 'connected'; state: MyState };

const t = ui.alumno;
const r = t.recuperar;
const WAIT_POLL_MS = 10_000;

/** Mensaje para un fallo al crear la sesión anónima. */
function authErrorMessage(error: unknown): string {
  if (isAuthApiError(error)) {
    if (error.code === 'anonymous_provider_disabled') return t.errores.anonymous_disabled;
    if (error.status === 429) return t.errores.rate_limited;
  }
  return ui.app.errorRed;
}

/** Garantiza una sesión anónima; devuelve un mensaje de error si no se pudo crear. */
async function ensureSession(): Promise<string | null> {
  const auth = getClient('student').auth;
  const { data } = await auth.getSession();
  if (data.session !== null) return null;
  const { error } = await auth.signInAnonymously();
  return error === null ? null : authErrorMessage(error);
}

/** ¿En qué punto está esta sesión? Partida, recuperación pendiente o nada. */
async function restore(): Promise<View> {
  const { data } = await getClient('student').auth.getSession();
  if (data.session === null) return { kind: 'join' };
  const state = await loadMyState();
  if (state !== null) return { kind: 'connected', state };
  const recovery = await loadMyRecovery();
  return recovery !== null && recovery.status !== 'approved'
    ? { kind: 'waiting', alias: recovery.alias, rejected: recovery.status === 'rejected' }
    : { kind: 'join' };
}

/** Vista del alumnado: unirse a una clase (o recuperar la partida) y, después, jugar. */
export function StudentHome() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [classCode, setClassCode] = useState('');
  const [alias, setAlias] = useState('');
  const [rescueKey, setRescueKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aliasTaken, setAliasTaken] = useState(false);

  useEffect(() => {
    let active = true;
    void restore()
      .catch((): View => ({ kind: 'join' }))
      .then((next) => {
        if (active) setView(next);
      });
    return () => {
      active = false;
    };
  }, []);

  // Mientras el docente no apruebe, se comprueba de vez en cuando (sin saturar la wifi).
  const waiting = view.kind === 'waiting' && !view.rejected;
  useEffect(() => {
    if (!waiting) return;
    let active = true;
    const timer = window.setInterval(() => {
      void restore()
        .then((next) => {
          if (active && next.kind !== 'join') setView(next);
        })
        .catch(() => undefined);
    }, WAIT_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [waiting]);

  async function enterGame() {
    const state = await loadMyState();
    setView(state === null ? { kind: 'join' } : { kind: 'connected', state });
  }

  async function join(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAliasTaken(false);
    const cleaned = cleanAlias(alias);
    const problem = aliasProblem(cleaned, blockedTerms);
    if (problem !== null) {
      setError(problem === 'format' ? t.errores.alias_format : t.errores.alias_blocked);
      return;
    }
    setBusy(true);
    try {
      const sessionError = await ensureSession();
      if (sessionError !== null) {
        setError(sessionError);
        return;
      }
      const result = await joinClass(classCode, cleaned);
      if (!result.ok) {
        setError(t.errores[result.error]);
        setAliasTaken(result.error === 'alias_taken');
        return;
      }
      await enterGame();
    } catch {
      setError(ui.app.errorRed);
    } finally {
      setBusy(false);
    }
  }

  async function recover(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sessionError = await ensureSession();
      if (sessionError !== null) {
        setError(sessionError);
        return;
      }
      const result = await recoverPlayer(classCode, cleanAlias(alias), rescueKey);
      if (result.ok) {
        await enterGame();
      } else if (result.error === 'pending' || result.error === 'wrong_key') {
        setView({ kind: 'waiting', alias: cleanAlias(alias), rejected: false });
      } else {
        setError(r.errores[result.error]);
      }
    } catch {
      setError(ui.app.errorRed);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === 'loading') {
    return (
      <Screen title={ui.app.titulo}>
        <p role="status">{ui.app.cargando}</p>
      </Screen>
    );
  }

  if (view.kind === 'connected') {
    return (
      <Game
        initial={view.state}
        onLost={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (view.kind === 'waiting') {
    return (
      <Screen kicker={ui.app.titulo} title={r.esperandoTitulo}>
        {view.rejected ? (
          <Notice tone="error">{r.rechazada}</Notice>
        ) : (
          <p className="lead" role="status">
            {fmt(r.esperandoTexto, { alias: view.alias })}
          </p>
        )}
      </Screen>
    );
  }

  const codeField = (
    <Field
      label={t.codigoEtiqueta}
      help={t.codigoAyuda}
      value={classCode}
      onChange={(event) => {
        setClassCode(event.target.value.toUpperCase());
      }}
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={8}
      enterKeyHint="next"
      required
    />
  );
  const aliasField = (
    <Field
      label={t.aliasEtiqueta}
      help={t.aliasAyuda}
      value={alias}
      onChange={(event) => {
        setAlias(event.target.value);
      }}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={16}
      enterKeyHint="next"
      required
    />
  );

  if (view.kind === 'recover') {
    return (
      <Screen kicker={ui.app.titulo} title={r.titulo}>
        <p className="lead">{r.ayuda}</p>
        <form className="stack" onSubmit={(event) => void recover(event)} noValidate>
          {codeField}
          {aliasField}
          <Field
            label={r.claveEtiqueta}
            help={r.claveAyuda}
            value={rescueKey}
            onChange={(event) => {
              setRescueKey(event.target.value.toUpperCase());
            }}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            enterKeyHint="go"
          />
          {error !== null && <Notice tone="error">{error}</Notice>}
          <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? r.recuperando : r.boton}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setError(null);
              setView({ kind: 'join' });
            }}
          >
            {r.volver}
          </button>
        </form>
      </Screen>
    );
  }

  const toRecover = () => {
    setError(null);
    setAliasTaken(false);
    setView({ kind: 'recover' });
  };

  return (
    <Screen kicker={ui.app.titulo} title={t.unirseTitulo}>
      <p className="lead">{t.bienvenida}</p>
      <form className="stack" onSubmit={(event) => void join(event)} noValidate>
        {codeField}
        {aliasField}
        {error !== null && <Notice tone="error">{error}</Notice>}
        {aliasTaken && (
          <button className="btn btn-secondary" type="button" onClick={toRecover}>
            {r.esMio}
          </button>
        )}
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? t.uniendose : t.unirseBoton}
        </button>
      </form>
      <button className="link-button" type="button" onClick={toRecover}>
        {r.enlace}
      </button>
    </Screen>
  );
}
