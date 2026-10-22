/** Datos del expediente PDF a partir de la partida archivada y del contenido (§9). */
import {
  concepts,
  dilemmas,
  endings,
  fichas,
  reflection,
  rubric,
  ui,
} from '@shared/generated/content.ts';
import { computeEnding } from '@shared/game/endings.ts';
import { desnivel, WORLD_VARS, type WorldState } from '@shared/game/world.ts';
import type { Ending } from '@shared/schemas/content.ts';
import type { MyDossier } from '@shared/schemas/state.ts';
// Solo tipos: pdf-lib se carga bajo demanda al generar el PDF.
import type { DossierPdfInput } from '../../../engine/pdf/dossier.ts';
import { replyLabel, twistNote } from '../../../lib/answers.ts';
import { fmt, formatDate } from '../../../lib/text.ts';
import { findCounselor, texto } from './helpers.ts';
import { ACHIEVEMENTS, emblemPieces, summaryOf } from './rewards.ts';

const p = ui.pdf;

/** Final guardado por el servidor; si aún no lo hay, el que corresponde al mundo (mismo cálculo). */
export function endingFor(id: string | null, world: WorldState): Ending {
  return endings.find((e) => e.id === id) ?? computeEnding(world, endings);
}

const listFormat = new Intl.ListFormat('es-ES', { type: 'conjunction' });

const signed = (n: number) => (n > 0 ? `+${String(n)}` : n < 0 ? `−${String(-n)}` : '0');

/**
 * Textos del PDF. `name` es el nombre real escrito en el móvil: solo vive en memoria y en el
 * propio PDF (nunca se envía ni se guarda).
 */
export function dossierPdfInput(dossier: MyDossier, name: string, now: Date): DossierPdfInput {
  const code = dossier.verifyCode ?? '';
  const ending = endingFor(dossier.ending, dossier.world);

  // En el orden del juego (capítulo y orden), no en el de las respuestas.
  const entries = dilemmas.flatMap((dilemma) => {
    const answer = dossier.answers.find((a) => a.dilemmaId === dilemma.id);
    const option = dilemma.opciones.find((o) => o.id === answer?.choice);
    if (answer === undefined || option === undefined) return [];
    const objector = findCounselor(answer.objector);
    return [
      {
        heading: `${dilemma.lugar}, ${String(dilemma.anio)} · ${texto(dilemma.titulo)}`,
        sections: [
          {
            label: p.decision,
            text: [`${option.id}. ${texto(option.texto)}`, twistNote(option.id, answer.firstChoice)]
              .filter((part) => part !== null)
              .join(' '),
          },
          { label: p.justificacion, text: answer.justification ?? p.sinTexto },
          {
            label: fmt(p.objecion, { nombre: objector?.nombre ?? '' }),
            text: answer.objection ?? p.sinTexto,
          },
          { label: replyLabel(answer.replyStance), text: answer.reply ?? p.sinTexto },
          { label: p.archivo, text: texto(dilemma.archivoReal.texto) },
        ],
      },
    ];
  });

  // Logros (M6): juego, no evaluación. Se dice en la propia página.
  const summary = summaryOf(dossier.progress);
  const pieces = emblemPieces(dossier.emblem);
  const listOrNone = (items: readonly string[]) => (items.length > 0 ? items : [p.ninguno]);
  const earned = ACHIEVEMENTS.flatMap((achievement) => {
    const count = summary.earned.get(achievement.id) ?? 0;
    if (count === 0) return [];
    return [count > 1 ? `${achievement.etiqueta} ×${String(count)}` : achievement.etiqueta];
  });

  return {
    documentTitle: `${p.titulo} · ${p.subtitulo}`,
    labels: {
      titulo: p.titulo,
      subtitulo: p.subtitulo,
      materia: p.materia,
      nombre: p.nombre,
      grupo: p.grupo,
      alias: p.alias,
      codigo: p.codigo,
      fecha: p.fecha,
      final: p.final,
      verificacion: p.verificacion,
      ruta: p.ruta,
      mundo: p.mundo,
      desnivel: p.desnivel,
      reflexion: p.reflexion,
      rubrica: p.rubrica,
      criterio: p.criterio,
      observaciones: p.observaciones,
    },
    cover: {
      name,
      group: dossier.classLabel,
      alias: dossier.alias,
      code,
      date: formatDate(dossier.finishedAt ?? now.toISOString()),
      ending: texto(ending.titulo),
    },
    entries,
    world: {
      meters: WORLD_VARS.map((variable) => ({
        label: ui.juego.mundo[variable],
        value: dossier.world[variable],
      })),
      gap: signed(desnivel(dossier.world)),
    },
    ending: { title: texto(ending.titulo), text: texto(ending.texto) },
    reflection: { question: texto(reflection.pregunta), text: dossier.reflection ?? p.sinTexto },
    rubric: {
      levels: rubric.niveles,
      reference: rubric.referencia ?? null,
      criteria: rubric.criterios.map((c) => ({
        name: `${c.id}. ${c.nombre}`,
        description: c.descripcion,
        curriculum:
          c.curriculo === undefined || c.curriculo.length === 0
            ? null
            : fmt(p.curriculo, { codigos: listFormat.format(c.curriculo) }),
      })),
    },
    badge: {
      rank: summary.rank.label,
      emblemPath: pieces.symbol.path,
      emblemColor: pieces.color.hex,
    },
    achievements: {
      title: p.logros,
      note: p.logrosNota,
      groups: [
        {
          label: p.rango,
          items: [`${summary.rank.label} · ${fmt(p.puntos, { n: summary.points })}`],
        },
        { label: p.logrosLista, items: listOrNone(earned) },
        {
          label: fmt(p.estrellas, { n: summary.stars.length, total: concepts.length }),
          items: listOrNone(
            concepts.filter((c) => summary.stars.includes(c.id)).map((c) => c.etiqueta),
          ),
        },
        {
          label: p.fichas,
          items: listOrNone(
            fichas.filter((f) => summary.fichas.includes(f.id)).map((f) => texto(f.titulo)),
          ),
        },
      ],
    },
    footer: (page, total) => fmt(p.pie, { codigo: code, n: page, total }),
  };
}

export function dossierFileName(code: string): string {
  return fmt(p.archivoNombre, { codigo: code });
}
