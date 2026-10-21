import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { getClient } from './supabase.ts';

export type TeacherSession =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'not-teacher' }
  | { readonly status: 'error' }
  | { readonly status: 'teacher'; readonly userId: string; readonly displayName: string };

async function resolveTeacher(session: Session | null): Promise<TeacherSession> {
  if (session === null) return { status: 'signed-out' };
  const { data, error } = await getClient('teacher')
    .from('teachers')
    .select('display_name')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error !== null) return { status: 'error' };
  return data === null
    ? { status: 'not-teacher' }
    : { status: 'teacher', userId: session.user.id, displayName: data.display_name };
}

/** Sesión docente (lista blanca `teachers`), compartida por /consola y /centro. */
export function useTeacherSession(): TeacherSession {
  const [state, setState] = useState<TeacherSession>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const { data } = getClient('teacher').auth.onAuthStateChange((_event, session) => {
      // Supabase desaconseja await dentro de este callback: se resuelve en la siguiente vuelta.
      setTimeout(() => {
        void resolveTeacher(session).then((next) => {
          if (active) setState(next);
        });
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
