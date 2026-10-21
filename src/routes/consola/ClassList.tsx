import { classModes, ui } from '@shared/generated/content.ts';
import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import type { Database } from '../../lib/database.types.ts';
import { getClient } from '../../lib/supabase.ts';
import { fmt, formatDate } from '../../lib/text.ts';
import { Field } from '../../ui/Field.tsx';
import { Notice } from '../../ui/Notice.tsx';

const t = ui.consola;

export type ClassSummary = Pick<
  Database['public']['Tables']['classes']['Row'],
  'id' | 'label' | 'code' | 'chapter_unlocked' | 'expires_at'
>;

const createdSchema = z.object({ id: z.string(), code: z.string() });

async function fetchClasses(): Promise<readonly ClassSummary[]> {
  const { data, error } = await getClient('teacher')
    .from('classes')
    .select('id, label, code, chapter_unlocked, expires_at')
    .order('created_at', { ascending: false });
  if (error !== null) throw new Error(error.message);
  return data;
}

type ClassListProps = {
  readonly onOpen: (schoolClass: ClassSummary) => void;
};

export function ClassList({ onOpen }: ClassListProps) {
  const [classes, setClasses] = useState<readonly ClassSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    fetchClasses().then(
      (list) => {
        if (!active) return;
        setClasses(list);
        setLoadError(false);
      },
      () => {
        if (active) setLoadError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [reloads]);

  return (
    <div className="stack">
      <section className="stack" aria-labelledby="mis-clases">
        <h2 id="mis-clases">{t.misClases}</h2>
        {loadError && <Notice tone="error">{ui.app.errorRed}</Notice>}
        {classes === null && !loadError && <p role="status">{ui.app.cargando}</p>}
        {classes?.length === 0 && <p className="muted">{t.sinClases}</p>}
        {classes !== null && classes.length > 0 && (
          <ul className="card-list">
            {classes.map((c) => (
              <li key={c.id}>
                <button
                  className="card card-button"
                  type="button"
                  onClick={() => {
                    onOpen(c);
                  }}
                >
                  <span className="card-title">{c.label}</span>
                  <span className="mono">{c.code}</span>
                  <span className="muted">
                    {fmt(t.caduca, { fecha: formatDate(c.expires_at) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CreateClassForm
        onCreated={(created) => {
          setReloads((n) => n + 1);
          onOpen(created);
        }}
      />
    </div>
  );
}

function CreateClassForm({ onCreated }: { readonly onCreated: (c: ClassSummary) => void }) {
  const modeId = useId();
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState(classModes[0]?.id ?? '');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = classModes.find((m) => m.id === mode);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const retention = Number.parseInt(days, 10);
      const { data, error: rpcError } = await getClient('teacher').rpc('create_class', {
        p_label: label.trim(),
        p_chapter_1: selected.capitulo1,
        p_chapter_2: selected.capitulo2,
        p_retention_days: retention,
      });
      const created = createdSchema.safeParse(data);
      if (rpcError !== null || !created.success) {
        setError(ui.app.errorInesperado);
        return;
      }
      setLabel('');
      const expires = new Date(Date.now() + retention * 86_400_000).toISOString();
      onCreated({
        id: created.data.id,
        code: created.data.code,
        label: label.trim(),
        chapter_unlocked: 1,
        expires_at: expires,
      });
    } catch {
      setError(ui.app.errorRed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack panel" aria-labelledby="nueva-clase">
      <h2 id="nueva-clase">{t.crearTitulo}</h2>
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <Field
          label={t.nombreClaseEtiqueta}
          help={t.nombreClaseAyuda}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
          maxLength={40}
          required
        />
        <div className="field">
          <label htmlFor={modeId}>{t.modoEtiqueta}</label>
          <select
            id={modeId}
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
            }}
            aria-describedby={`${modeId}-help`}
          >
            {classModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.etiqueta}
              </option>
            ))}
          </select>
          {selected !== undefined && (
            <p id={`${modeId}-help`} className="help">
              {selected.descripcion}
            </p>
          )}
        </div>
        <Field
          label={t.retencionEtiqueta}
          help={t.retencionAyuda}
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          value={days}
          onChange={(event) => {
            setDays(event.target.value);
          }}
          required
        />
        {error !== null && <Notice tone="error">{error}</Notice>}
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? t.creando : t.crearBoton}
        </button>
      </form>
    </section>
  );
}
