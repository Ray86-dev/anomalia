import { ui } from '@shared/generated/content.ts';
import { useState } from 'react';
import { getClient } from '../../lib/supabase.ts';
import { useTeacherSession } from '../../lib/teacher.ts';
import { Notice } from '../../ui/Notice.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { ClassDetail } from './ClassDetail.tsx';
import { ClassList, type ClassSummary } from './ClassList.tsx';
import { LoginForm } from './LoginForm.tsx';
import { VerifyDossier } from './VerifyDossier.tsx';

const t = ui.consola;

function SignOutButton() {
  return (
    <button
      className="btn btn-secondary btn-small"
      type="button"
      onClick={() => {
        void getClient('teacher').auth.signOut();
      }}
    >
      {t.salir}
    </button>
  );
}

/** /consola: privada del docente. Pensada para su móvil (el PC del aula suele proyectarse). */
export function ConsoleRoute() {
  const session = useTeacherSession();
  const [open, setOpen] = useState<ClassSummary | null>(null);

  switch (session.status) {
    case 'loading':
      return (
        <Screen title={t.titulo}>
          <p role="status">{ui.app.cargando}</p>
        </Screen>
      );
    case 'signed-out':
      return <LoginForm />;
    case 'error':
    case 'not-teacher':
      return (
        <Screen title={t.titulo}>
          <Notice tone="error">{session.status === 'error' ? ui.app.errorRed : t.noDocente}</Notice>
          <SignOutButton />
        </Screen>
      );
    case 'teacher':
      return (
        <Screen kicker={session.displayName} title={t.titulo}>
          <SignOutButton />
          {open === null ? (
            <>
              <ClassList onOpen={setOpen} />
              <VerifyDossier />
            </>
          ) : (
            <ClassDetail
              schoolClass={open}
              onBack={() => {
                setOpen(null);
              }}
            />
          )}
        </Screen>
      );
  }
}

export default ConsoleRoute;
