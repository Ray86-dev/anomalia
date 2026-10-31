/** Final de la partida (§6): epílogo, reflexión final y expediente PDF (§9). */
import { ambients, dilemmas, endings, reflection, ui } from '@shared/generated/content.ts';
import {
  explainEnding,
  type Comparison,
  type EndingReason,
  type EndingVar,
} from '@shared/game/endings.ts';
import { worldHistory, type HistoryStep } from '@shared/game/history.ts';
import { desnivel, gapZone, WORLD_VARS, type WorldVar } from '@shared/game/world.ts';
import type { Ending, Panel } from '@shared/schemas/content.ts';
import { MAX_REFLECTION_CHARS } from '@shared/schemas/partida.ts';
import type { MyDossier } from '@shared/schemas/state.ts';
import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { tensionFor } from '../../../../engine/audio.ts';
import { assetUrl } from '../../../../engine/backdrop/Backdrop.tsx';
import { Cinematic } from '../../../../engine/cinematic/Cinematic.tsx';
import { loadMyDossier } from '../../../../lib/api.ts';
import { fmt } from '../../../../lib/text.ts';
import { Notice } from '../../../../ui/Notice.tsx';
import { CinematicPlayer } from '../CinematicPlayer.tsx';
import { dossierFileName, dossierPdfInput, endingFor } from '../dossier.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, signed, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, Listen, TextAnswer, useSubScreen } from '../parts.tsx';
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

/** «menos de 40», «25 o más»… */
const RULES = {
  '<': t.epilogo.reglas.menor,
  '<=': t.epilogo.reglas.menorIgual,
  '>': t.epilogo.reglas.mayor,
  '>=': t.epilogo.reglas.mayorIgual,
} as const;

const variableLabel = (variable: EndingVar) =>
  variable === 'desnivel' ? t.ondas.desnivel : t.mundo[variable];

/** El Desnivel lleva signo; las barras, no. */
const valueText = (variable: EndingVar, value: number) =>
  variable === 'desnivel' ? signed(value) : String(value);

const ruleText = (c: Comparison) => fmt(RULES[c.op], { n: valueText(c.var, c.valor) });

/** Cómo se llega a un final, en palabras («Equidad menos de 40 · …»). */
function conditionText(ending: Ending): string {
  if (ending.condicion === null) return t.epilogo.porDefecto;
  return ending.condicion.todas.map((c) => `${variableLabel(c.var)} ${ruleText(c)}`).join(' · ');
}

const reasonText = (reason: EndingReason) =>
  fmt(t.epilogo.condicion, {
    variable: variableLabel(reason.var),
    valor: valueText(reason.var, reason.actual),
    regla: ruleText(reason),
  });

/** Cambios reales de una decisión («Poder +5 · Confianza +10»). */
function changesOf(step: HistoryStep): { readonly variable: WorldVar; readonly change: number }[] {
  return WORLD_VARS.map((variable) => ({
    variable,
    change: step.after[variable] - step.before[variable],
  })).filter(({ change }) => change !== 0);
}

/** Paso 1 del epílogo (D-89): cada decisión, en orden, con lo que movió. */
function Recap({ onNext }: { readonly onNext: () => void }) {
  const { run } = useGameContext();
  const items = worldHistory(run.progress.classDilemmas, run.progress.choices, dilemmas).flatMap(
    (step) => {
      const dilemma = dilemmas.find((d) => d.id === step.dilemmaId);
      const option = dilemma?.opciones.find((o) => o.id === step.choice);
      return dilemma === undefined || option === undefined ? [] : [{ step, dilemma, option }];
    },
  );
  const gap = desnivel(run.world);
  const zone = gapZone(gap);
  const gapText = fmt(t.epilogo.desnivelFinal, {
    valor: signed(gap),
    zona: t.ondas.zonas[zone],
  });
  const place = (lugar: string, anio: number) => fmt(t.epilogo.lugar, { lugar, anio });
  const spoken = [
    t.epilogo.texto,
    ...items.map(
      ({ dilemma, option }) =>
        `${place(dilemma.lugar, dilemma.anio)}: ${option.corto}. ${texto(option.ondas.titular)}.`,
    ),
    gapText,
  ].join(' ');

  return (
    <>
      <p className="kicker">{t.epilogo.titulo}</p>
      <h1 tabIndex={-1} data-focus>
        {t.epilogo.decisiones}
      </h1>
      <p className="lead">{t.epilogo.texto}</p>
      <p className="help">{t.epilogo.decisionesAyuda}</p>
      <Listen auto text={spoken} />
      <ol className="recap-list">
        {items.map(({ step, dilemma, option }, i) => {
          const changes = changesOf(step);
          return (
            <li
              key={dilemma.id}
              className="recap-item"
              style={{ animationDelay: `${String(0.3 + i * 0.6)}s` }}
            >
              <span className="recap-when">{place(dilemma.lugar, dilemma.anio)}</span>
              <strong className="recap-choice">{option.corto}</strong>
              <span className="recap-headline">{texto(option.ondas.titular)}</span>
              {changes.length === 0 ? (
                <span className="help">{t.epilogo.sinCambios}</span>
              ) : (
                <span className="recap-changes">
                  {changes.map(({ variable, change }) => (
                    <span key={variable} className={`recap-change ${change > 0 ? 'up' : 'down'}`}>
                      {t.mundo[variable]} {signed(change)}
                    </span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p
        className="recap-gap"
        data-zone={zone}
        style={{ animationDelay: `${String(0.3 + items.length * 0.6)}s` }}
      >
        {gapText}
      </p>
      <ActionBar>
        <button className="btn" type="button" onClick={onNext}>
          {t.epilogo.verFuturo}
        </button>
      </ActionBar>
    </>
  );
}

/** Último paso del epílogo: el final, por qué se llegó a él y los otros 2077 posibles. */
function EndingSummary({ ending }: { readonly ending: Ending }) {
  const { run } = useGameContext();
  const reasons = explainEnding(ending, run.world);
  const why = reasons.length === 0 ? [t.epilogo.sinExtremos] : reasons.map(reasonText);
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.epilogo.titulo}
      </h1>
      <section className="panel stack ending-card" aria-labelledby="final-alcanzado">
        <p className="kicker">{t.epilogo.final}</p>
        <h2 id="final-alcanzado">{texto(ending.titulo)}</h2>
        <p className="headline">{texto(ending.resumen)}</p>
        <p>{texto(ending.texto)}</p>
      </section>
      <section className="panel stack" aria-labelledby="por-que-final">
        <h2 id="por-que-final">{t.epilogo.porQue}</h2>
        {reasons.length > 0 && <p className="help">{t.epilogo.porQueAyuda}</p>}
        <ul className="reasons">
          {why.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <Listen
        auto
        text={`${texto(ending.titulo)}. ${texto(ending.resumen)} ${t.epilogo.porQue}: ${why.join('. ')}`}
      />
      <WorldMeters world={run.world} />
      <details className="panel explain other-endings">
        <summary>{t.epilogo.otros}</summary>
        <p className="help">{t.epilogo.otrosAyuda}</p>
        <ul className="other-list">
          {endings
            .filter((other) => other.id !== ending.id)
            .map((other) => (
              <li key={other.id}>
                <strong>{texto(other.titulo)}</strong>
                <span>{texto(other.resumen)}</span>
                <span className="help">{conditionText(other)}</span>
              </li>
            ))}
        </ul>
      </details>
      <ActionBar>
        <AdvanceButton label={t.epilogo.continuar} />
      </ActionBar>
    </>
  );
}

type EpilogueStep =
  | { readonly kind: 'recap' }
  | { readonly kind: 'cine'; readonly index: number }
  | { readonly kind: 'summary' };

/**
 * Epílogo animado (D-89): repaso de las decisiones sobre el hilo temporal ya cerrado, la
 * transformación del 2077 según el final, el mensaje de Ari y el resumen. Los pasos son
 * locales: al recargar se vuelve al repaso.
 */
export function Epilogue() {
  const { run } = useGameContext();
  const ending = endingFor(run.ending, run.world);
  const [step, setStep] = useState<EpilogueStep>({ kind: 'recap' });
  useSubScreen(step.kind);

  const panels: Panel[] = [...ending.secuencia, { plano: 'ari', voz: 'ari', texto: ending.ari }];
  const endingShot = ending.secuencia[0]?.plano ?? 'final-equilibrio';
  const shot =
    step.kind === 'recap'
      ? 'recap'
      : step.kind === 'cine'
        ? (panels[step.index]?.plano ?? endingShot)
        : endingShot;
  const toSummary = () => {
    setStep({ kind: 'summary' });
  };

  return (
    <>
      <Cinematic shot={shot} instability={tensionFor(desnivel(run.world))} />
      {step.kind === 'recap' && (
        <Recap
          onNext={() => {
            setStep({ kind: 'cine', index: 0 });
          }}
        />
      )}
      {step.kind === 'cine' && (
        <CinematicPlayer
          panels={panels}
          index={step.index}
          onIndex={(index) => {
            setStep({ kind: 'cine', index });
          }}
          title={texto(ending.titulo)}
          skipLabel={t.epilogo.saltar}
          onSkip={toSummary}
          finalAction={
            <button className="btn" type="button" onClick={toSummary}>
              {t.epilogo.verResumen}
            </button>
          }
        />
      )}
      {step.kind === 'summary' && <EndingSummary ending={ending} />}
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
      <Listen auto text={`${texto(reflection.pregunta)} ${texto(reflection.pista)}`} />
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
