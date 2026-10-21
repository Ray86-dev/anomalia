import { blockedTerms, ui } from '@shared/generated/content.ts';
import { aliasProblem, cleanAlias } from '@shared/game/alias.ts';
import type { MyState } from '@shared/schemas/state.ts';
import { isAuthApiError } from '@supabase/supabase-js';
import { useEffect, useState, type SubmitEvent } from 'react';
import { joinClass, loadMyState } from '../../lib/api.ts';
import { getClient } from '../../lib/supabase.ts';
import { fmt } from '../../lib/text.ts';
import { Field } from '../../ui/Field.tsx';
import { Notice } from '../../ui/Notice.tsx';
import { Screen } from '../../ui/Screen.tsx';

type View = { kind: 'loading' } | { kind: 'join' } | { kind: 'connected'; state: MyState };

const t = ui.alumno;

/** Mensaje para un fallo al crear la sesión anónima. */
function authErrorMessage(error: unknown): string {
  if (isAuthApiError(error)) {
    if (error.code === 'anonymous_provider_disabled') return t.errores.anonymous_disabled;
    if (error.status === 429) return t.errores.rate_limited;
  }
  return ui.app.errorRed;
}

/** Vista del alumnado (M0): unirse a una clase y ver la sesión activa. */
export function StudentHome() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [classCode, setClassCode] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function restore(): Promise<View> {
      const { data } = await getClient('student').auth.getSession();
      if (data.session === null) return { kind: 'join' };
      const state = await loadMyState();
      return state === null ? { kind: 'join' } : { kind: 'connected', state };
    }
    void restore()
      .catch((): View => ({ kind: 'join' }))
      .then((next) => {
        if (active) setView(next);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const cleaned = cleanAlias(alias);
    const problem = aliasProblem(cleaned, blockedTerms);
    if (problem !== null) {
      setError(problem === 'format' ? t.errores.alias_format : t.errores.alias_blocked);
      return;
    }

    setBusy(true);
    try {
      const auth = getClient('student').auth;
      const { data } = await auth.getSession();
      if (data.session === null) {
        const { error: signInError } = await auth.signInAnonymously();
        if (signInError !== null) {
          setError(authErrorMessage(signInError));
          return;
        }
      }
      const result = await joinClass(classCode, cleaned);
      if (!result.ok) {
        setError(t.errores[result.error]);
        return;
      }
      const state = await loadMyState();
      setView(state === null ? { kind: 'join' } : { kind: 'connected', state });
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
    const { player, class: schoolClass } = view.state;
    return (
      <Screen kicker={ui.app.titulo} title={fmt(t.conectadoTitulo, { alias: player.alias })}>
        <p>{fmt(t.conectadoClase, { clase: schoolClass.label })}</p>
        {player.status === 'expelled' ? (
          <Notice tone="error">{t.errores.expelled}</Notice>
        ) : (
          <Notice>{t.conectadoEspera}</Notice>
        )}
      </Screen>
    );
  }

  return (
    <Screen kicker={ui.app.titulo} title={t.unirseTitulo}>
      <p className="lead">{t.bienvenida}</p>
      <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
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
          enterKeyHint="go"
          required
        />
        {error !== null && <Notice tone="error">{error}</Notice>}
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? t.uniendose : t.unirseBoton}
        </button>
      </form>
    </Screen>
  );
}
