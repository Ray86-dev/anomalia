import { ui } from '@shared/generated/content.ts';
import { useState, type SubmitEvent } from 'react';
import { getClient } from '../../lib/supabase.ts';
import { Field } from '../../ui/Field.tsx';
import { Notice } from '../../ui/Notice.tsx';
import { Screen } from '../../ui/Screen.tsx';

const t = ui.consola;

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getClient('teacher').auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      // Si va bien, useTeacherSession detecta la sesión nueva y cambia de vista.
      if (authError !== null) setError(t.errorCredenciales);
    } catch {
      setError(ui.app.errorRed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen kicker={t.titulo} title={t.accesoTitulo}>
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <Field
          label={t.emailEtiqueta}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
        />
        <Field
          label={t.contrasenaEtiqueta}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          required
        />
        {error !== null && <Notice tone="error">{error}</Notice>}
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? t.entrando : t.entrar}
        </button>
      </form>
    </Screen>
  );
}
