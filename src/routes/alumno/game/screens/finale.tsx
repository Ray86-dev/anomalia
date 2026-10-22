/** Final de la partida (§6): epílogo, reflexión final y expediente PDF (§9). */
import { ambients, dilemmas, reflection, ui } from '@shared/generated/content.ts';
import { MAX_REFLECTION_CHARS } from '@shared/schemas/partida.ts';
import type { MyDossier } from '@shared/schemas/state.ts';
import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { assetUrl } from '../../../../engine/backdrop/Backdrop.tsx';
import { loadMyDossier } from '../../../../lib/api.ts';
import { fmt } from '../../../../lib/text.ts';
import { Notice } from '../../../../ui/Notice.tsx';
import { dossierFileName, dossierPdfInput, endingFor } from '../dossier.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, AriMessage, TextAnswer } from '../parts.tsx';
import { WorldMeters } from './outcome.tsx';

const t = ui.juego;

/** Datos del expediente (`my_dossier`): `undefined` mientras carga, `null` si falla. */
function useMyDossier(): MyDossier | null | undefined {
  const [dossier, setDossier] = useState<MyDossier | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    loadMyDossier().then(
      (loaded) => {
        if (active) setDossier(loaded);
      },
      () => {
        if (active) setDossier(null);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return dossier;
}

export function Epilogue() {
  const { run } = useGameContext();
  const ending = endingFor(run.ending, run.world);
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.epilogo.titulo}
      </h1>
      <p className="lead">{t.epilogo.texto}</p>
      <section className="panel stack ending-card" aria-labelledby="final-alcanzado">
        <p className="kicker">{t.epilogo.final}</p>
        <h2 id="final-alcanzado">{texto(ending.titulo)}</h2>
        <p className="headline">{texto(ending.resumen)}</p>
        <p>{texto(ending.texto)}</p>
      </section>
      <AriMessage text={texto(ending.ari)} />
      <WorldMeters world={run.world} />
      <ActionBar>
        <AdvanceButton label={t.epilogo.continuar} />
      </ActionBar>
    </>
  );
}

/** Recordatorio de las decisiones propias: la pregunta pide usar al menos una. */
function MyDecisions({ dossier }: { readonly dossier: MyDossier }) {
  const items = dilemmas.flatMap((dilemma) => {
    const answer = dossier.answers.find((a) => a.dilemmaId === dilemma.id);
    const option = dilemma.opciones.find((o) => o.id === answer?.choice);
    if (option === undefined) return [];
    const objector = findCounselor(answer?.objector);
    return [{ dilemma, option, objector }];
  });
  if (items.length === 0) return null;
  return (
    <section className="panel stack" aria-labelledby="mis-decisiones">
      <h2 id="mis-decisiones">{t.reflexion.decisiones}</h2>
      <ul className="decision-list">
        {items.map(({ dilemma, option, objector }) => (
          <li key={dilemma.id}>
            <span className="decision-place">
              {dilemma.lugar}, {dilemma.anio}
            </span>{' '}
            {option.id}. {option.corto}
            {objector !== undefined && (
              <span className="muted">
                {' '}
                · {fmt(t.reflexion.objetor, { nombre: objector.nombre })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Reflection() {
  const { act } = useGameContext();
  const dossier = useMyDossier();
  const [min, max] = reflection.palabras;
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.reflexion.titulo}
      </h1>
      <p className="lead">{t.reflexion.intro}</p>
      <p className="prompt">{texto(reflection.pregunta)}</p>
      <p className="help">{texto(reflection.pista)}</p>
      {dossier !== undefined && dossier !== null && <MyDecisions dossier={dossier} />}
      <TextAnswer
        label={t.reflexion.etiqueta}
        help={`${fmt(t.reflexion.ayuda, { min, max })} ${t.reflexion.aviso}`}
        draftKey="reflexion-final"
        range={reflection.palabras}
        maxChars={MAX_REFLECTION_CHARS}
        submitLabel={t.reflexion.enviar}
        pendingLabel={t.reflexion.enviando}
        onSubmit={async (text) => {
          const response = await act({ action: 'reflect', text });
          return response?.ok === true;
        }}
      />
    </>
  );
}

type Generated = { readonly file: File; readonly shareable: boolean };

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Margen para que el navegador empiece la descarga antes de liberar el archivo.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
}

export function Dossier() {
  const dossier = useMyDossier();
  const nameId = useId();
  // El nombre real solo vive aquí, en memoria: no se envía ni se guarda (§9).
  const [name, setName] = useState('');
  const [missingName, setMissingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  if (dossier === undefined) return <p role="status">{ui.app.cargando}</p>;
  if (dossier?.verifyCode == null) return <Notice tone="error">{ui.app.errorRed}</Notice>;
  const code = dossier.verifyCode;

  const generate = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = name.trim();
    if (fullName === '') {
      setMissingName(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const { generateDossierPdf } = await import('../../../../engine/pdf/generate.ts');
      const layer = ambients['2077'].capas[0];
      const bytes = await generateDossierPdf(dossierPdfInput(dossier, fullName, new Date()), {
        fonts: {
          regular: assetUrl('fonts/AtkinsonHyperlegible-Regular.ttf'),
          bold: assetUrl('fonts/AtkinsonHyperlegible-Bold.ttf'),
        },
        image: layer === undefined ? null : { url: assetUrl(layer.src), credit: layer.credito },
      });
      const file = new File([bytes.slice()], dossierFileName(code), { type: 'application/pdf' });
      setGenerated({
        file,
        shareable: 'canShare' in navigator && navigator.canShare({ files: [file] }),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (error) {
      // Cerrar la hoja de compartir no es un error; cualquier otro fallo, a descargar.
      if (!(error instanceof DOMException && error.name === 'AbortError')) downloadFile(file);
    }
  }

  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.expediente.titulo}
      </h1>
      <p className="lead">{t.expediente.texto}</p>
      <section className="panel stack" aria-labelledby="codigo-verificacion">
        <h2 id="codigo-verificacion" className="rescue-key-label">
          {t.expediente.codigo}
        </h2>
        <p className="verify-code">{code}</p>
        <p className="help">{t.expediente.codigoAyuda}</p>
      </section>
      <form
        className="stack"
        noValidate
        onSubmit={(event) => {
          void generate(event);
        }}
      >
        <div className="field">
          <label htmlFor={nameId}>{t.expediente.nombre}</label>
          <input
            id={nameId}
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={80}
            value={name}
            aria-describedby={`${nameId}-help`}
            aria-invalid={missingName}
            onChange={(event) => {
              setName(event.target.value);
              setMissingName(false);
              // Si cambia el nombre, el PDF ya generado no vale.
              setGenerated(null);
            }}
          />
          <p id={`${nameId}-help`} className="help">
            {t.expediente.nombreAyuda}
          </p>
          {missingName && <p className="inline-hint">{t.expediente.faltaNombre}</p>}
        </div>
        {failed && <Notice tone="error">{t.expediente.error}</Notice>}
        {generated === null ? (
          <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? t.expediente.generando : t.expediente.generar}
          </button>
        ) : (
          <div className="stack" role="status">
            <p className="chosen">{t.expediente.listo}</p>
            {generated.shareable && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  void share(generated.file);
                }}
              >
                {t.expediente.compartir}
              </button>
            )}
            <button
              className={generated.shareable ? 'btn btn-secondary' : 'btn'}
              type="button"
              onClick={() => {
                downloadFile(generated.file);
              }}
            >
              {t.expediente.descargar}
            </button>
            <p className="help">{t.expediente.fin}</p>
          </div>
        )}
      </form>
    </>
  );
}
