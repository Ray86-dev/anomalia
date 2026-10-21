import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { getClient } from '../../lib/supabase.ts';
import { snapshotSchema, type Snapshot } from './snapshot.ts';

/** Sondeo de respaldo por si la red del centro corta los WebSocket de Realtime. */
const POLL_MS = 20_000;
/** Agrupa avisos seguidos de Realtime (25 móviles avanzando a la vez) en una sola petición. */
const DEBOUNCE_MS = 1500;

async function fetchSnapshot(classId: string, force: boolean): Promise<Snapshot> {
  const { data, error } = await getClient('teacher').rpc('class_snapshot', {
    p_class_id: classId,
    p_force: force,
  });
  if (error !== null) throw new Error(error.message);
  return snapshotSchema.parse(data);
}

export type SnapshotState = {
  readonly snapshot: Snapshot | null;
  readonly failed: boolean;
  /** Fuerza la publicación de lo último (modo revelación). */
  readonly reveal: () => void;
};

/**
 * Snapshot agregado de una clase: se pide al cargar, al llegar un aviso por el canal
 * privado de Realtime «class:<id>» y, como respaldo, cada 20 s.
 */
export function useSnapshot(classId: string): SnapshotState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [request, setRequest] = useState({ n: 0, force: false });

  useEffect(() => {
    let active = true;
    fetchSnapshot(classId, request.force).then(
      (next) => {
        if (!active) return;
        setSnapshot(next);
        setFailed(false);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [classId, request]);

  useEffect(() => {
    const client = getClient('teacher');
    let debounce: number | undefined;
    const refresh = () => {
      setRequest((r) => ({ n: r.n + 1, force: false }));
    };
    const poll = window.setInterval(refresh, POLL_MS);
    const channel = client.channel(`class:${classId}`, { config: { private: true } });
    void client.realtime.setAuth().then(() => {
      channel
        .on('broadcast', { event: 'changed' }, () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(refresh, DEBOUNCE_MS);
        })
        .subscribe((status) => {
          // Si el canal falla, el sondeo sigue funcionando: no hace falta avisar al docente.
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) refresh();
        });
    });
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(debounce);
      void client.removeChannel(channel);
    };
  }, [classId]);

  const reveal = useCallback(() => {
    setRequest((r) => ({ n: r.n + 1, force: true }));
  }, []);

  return { snapshot, failed, reveal };
}
