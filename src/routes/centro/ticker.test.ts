import { concepts, dilemmas, ui } from '@shared/generated/content.ts';
import { describe, expect, it } from 'vitest';
import { majority, type Snapshot } from './snapshot.ts';
import { buildTicker, signed } from './ticker.ts';

function snapshot(results: Partial<Snapshot['results']> = {}, connected = 0): Snapshot {
  return {
    k: 5,
    generatedAt: '2026-10-22T10:00:00Z',
    label: '4.º ESO B',
    chapter1: ['d1'],
    chapter2: [],
    chapterUnlocked: 1,
    live: {
      players: 25,
      connected,
      phases: { prologue: 0, waiting: 0, final: 0 },
      dilemmas: { d1: { here: 25, done: 0 } },
    },
    results: { decisions: {}, world: null, concepts: [], endings: null, ...results },
    pendingAnswers: 0,
  };
}

const ticker = (s: Snapshot, revealed = true) =>
  buildTicker(s, revealed, ui.centro.teletipo, dilemmas, concepts);

describe('majority', () => {
  it('devuelve la opción más votada, o null si hay empate o faltan datos', () => {
    expect(majority({ n: 7, A: 1, B: 4, C: 2 })).toBe('B');
    expect(majority({ n: 6, A: 3, B: 3, C: 0 })).toBeNull();
    expect(majority({ n: null })).toBeNull();
    expect(majority(undefined)).toBeNull();
  });
});

describe('buildTicker', () => {
  it('sin datos muestra un mensaje de espera', () => {
    expect(ticker(snapshot())).toEqual([ui.centro.teletipo.espera]);
  });

  it('anuncia la mayoría de cada dilema solo con la revelación activada', () => {
    const s = snapshot({ decisions: { d1: { n: 6, A: 1, B: 4, C: 1 } } });
    expect(ticker(s)).toContain('ANOMALÍA EN 1633: la mayoría elige «Mantenerse firme»');
    expect(ticker(s, false).join(' ')).not.toMatch(/1633/);
  });

  it('señala el empate y nunca da distribuciones con menos de k respuestas', () => {
    expect(ticker(snapshot({ decisions: { d1: { n: 6, A: 3, B: 3, C: 0 } } }))).toContain(
      'ANOMALÍA EN 1633: la clase está dividida',
    );
    expect(ticker(snapshot({ decisions: { d1: { n: null } } })).join(' ')).not.toMatch(/1633/);
  });

  it('avisa del desnivel, de la inestabilidad y del concepto más invocado', () => {
    const s = snapshot(
      {
        world: { n: 8, poder: 80, responsabilidad: 50, equidad: 40, confianza: 50, desnivel: 30 },
        concepts: [{ id: 'dignidad', n: 5 }],
      },
      12,
    );
    expect(ticker(s)).toEqual([
      '12 CRONISTAS CONECTADOS',
      'DESNIVEL PROMETEICO DE LA CLASE: +30',
      ui.centro.teletipo.inestable,
      'CONCEPTO MÁS INVOCADO: DIGNIDAD',
    ]);
  });

  it('formatea el signo del desnivel', () => {
    expect([signed(7), signed(-4), signed(0)]).toEqual(['+7', '−4', '0']);
  });
});
