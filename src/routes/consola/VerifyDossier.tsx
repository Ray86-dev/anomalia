import { counselors, dilemmas, endings, ui } from '@shared/generated/content.ts';
import { worldSchema } from '@shared/schemas/partida.ts';
import { dossierAnswerSchema } from '@shared/schemas/state.ts';
import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { getClient } from '../../lib/supabase.ts';
import { replyLabel, twistNote } from '../../lib/answers.ts';
import { fmt, formatDate } from '../../lib/text.ts';
import { Field } from '../../ui/Field.tsx';
import { Notice } from '../../ui/Notice.tsx';

const t = ui.consola.verificar;
const p = ui.pdf;

/** Resultado de `verify_run`: la partida de ese código si es de una clase del docente. */
const verifiedSchema = z
  .object({
    alias: z.string(),
    classLabel: z.string(),
    status: z.enum(['active', 'expelled']),
    verifyCode: z.string(),
    finishedAt: z.string().nullable(),
    ending: z.string().nullable(),
    world: worldSchema,
    reflection: z.string().nullable(),
    answers: z.array(dossierAnswerSchema),
  })
  .nullable();
type Verified = NonNullable<z.infer<typeof verifiedSchema>>;

function VerifiedRun({ run }: { readonly run: Verified }) {
  const ending = endings.find((e) => e.id === run.ending);
  return (
    <article className="card stack" aria-labelledby="verificado">
      <h3 id="verificado">
        <span className="tag tag-ok">{t.valido}</span> {run.verifyCode}
      </h3>
      <p>
        {fmt(t.resumen, {
          alias: run.alias,
          clase: run.classLabel,
          fecha: run.finishedAt === null ? '—' : formatDate(run.finishedAt),
        })}
      </p>
      {run.status === 'expelled' && <Notice>{t.retirado}</Notice>}
      {ending !== undefined && <p>{fmt(t.final, { final: ending.titulo.normal })}</p>}
      {dilemmas.map((dilemma) => {
        const answer = run.answers.find((a) => a.dilemmaId === dilemma.id);
        const option = dilemma.opciones.find((o) => o.id === answer?.choice);
        if (answer === undefined || option === undefined) return null;
        const objector = counselors.find((c) => c.id === answer.objector);
        const twist = twistNote(option.id, answer.firstChoice);
        return (
          <section key={dilemma.id} className="stack verify-entry">
            <h4>
              {dilemma.lugar}, {dilemma.anio} · {p.decision}: {option.id}. {option.corto}
            </h4>
            {twist !== null && <p className="muted">{twist}</p>}
            <p className="muted">{p.justificacion}</p>
            <blockquote className="alert-text">{answer.justification ?? p.sinTexto}</blockquote>
            <p className="muted">{fmt(p.objecion, { nombre: objector?.nombre ?? '' })}</p>
            <blockquote className="alert-text">{answer.objection ?? p.sinTexto}</blockquote>
            <p className="muted">{replyLabel(answer.replyStance)}</p>
            <blockquote className="alert-text">{answer.reply ?? p.sinTexto}</blockquote>
          </section>
        );
      })}
      <section className="stack verify-entry">
        <h4>{p.reflexion}</h4>
        <blockquote className="alert-text">{run.reflection ?? p.sinTexto}</blockquote>
      </section>
    </article>
  );
}

/** Comprueba el código de verificación de un expediente PDF (§9, D-41). */
export function VerifyDossier() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Verified | 'not-found' | 'error' | null>(null);

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim() === '') return;
    setBusy(true);
    try {
      const { data, error } = await getClient('teacher').rpc('verify_run', { p_code: code });
      if (error !== null) throw new Error(error.message);
      setResult(verifiedSchema.parse(data) ?? 'not-found');
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack" aria-labelledby="verificar">
      <h2 id="verificar">{t.titulo}</h2>
      <form
        className="stack"
        onSubmit={(event) => {
          void verify(event);
        }}
      >
        <Field
          label={t.etiqueta}
          help={t.ayuda}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder={t.marcador}
          onChange={(event) => {
            setCode(event.target.value);
            setResult(null);
          }}
        />
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? t.buscando : t.boton}
        </button>
      </form>
      <div role="status">
        {result === 'not-found' && <Notice tone="error">{t.noEncontrado}</Notice>}
        {result === 'error' && <Notice tone="error">{ui.app.errorRed}</Notice>}
      </div>
      {result !== null && result !== 'not-found' && result !== 'error' && (
        <VerifiedRun run={result} />
      )}
    </section>
  );
}
