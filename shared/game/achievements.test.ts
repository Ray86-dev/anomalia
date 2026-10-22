import { describe, expect, it } from 'vitest';
import { concepts, emblems, fichas, rewards } from '../generated/content.ts';
import { EMPTY_PROGRESS, type Progress } from '../schemas/partida.ts';
import { newlyEarned, summarize } from './achievements.ts';

const catalog = { rewards, concepts, fichas, emblems };
const progress = (patch: Partial<Progress> = {}): Progress => ({
  ...EMPTY_PROGRESS,
  classDilemmas: ['d1', 'd2', 'd3', 'd4', 'd5'],
  ...patch,
});

describe('summarize', () => {
  it('una partida recién empezada no tiene puntos, pero sí el primer rango y piezas gratis', () => {
    const s = summarize(progress(), catalog);
    expect(s.points).toBe(0);
    expect(s.rank.id).toBe('aprendiz');
    expect(s.nextRank?.points).toBe(40); // 8 por anomalía × 5
    expect(s.symbols).toEqual(['estrella', 'reloj']);
    expect(s.colors).toEqual(['turquesa', 'ambar']);
  });

  it('cuenta movimientos repetidos y estrellas: 10 la primera vez, 3 cada repetición, 5 por estrella', () => {
    const s = summarize(
      progress({
        moves: ['da-razones', 'da-razones', 'pone-ejemplo', 'inventado'],
        concepts: ['dignidad', 'otro'],
      }),
      catalog,
    );
    expect(s.earned.get('da-razones')).toBe(2);
    expect(s.earned.has('inventado')).toBe(false);
    expect(s.stars).toEqual(['dignidad']);
    expect(s.points).toBe(10 + 3 + 10 + 5);
  });

  it('mantener y cambiar la decisión tras el giro valen lo mismo', () => {
    const keep = summarize(progress({ kept: 1 }), catalog);
    const change = summarize(progress({ changed: 1 }), catalog);
    expect(keep.points).toBe(change.points);
  });

  it('los hitos de estrellas y de anomalías se escalan con las anomalías de la clase', () => {
    const fewStars = progress({
      classDilemmas: ['d1', 'd3', 'd4'],
      concepts: ['dignidad', 'verdad', 'riesgo', 'libertad'],
    });
    expect(summarize(fewStars, catalog).earned.get('estrellas-a')).toBe(1); // ⌈1,2 × 3⌉ = 4
    expect(
      summarize(progress({ concepts: ['dignidad', 'verdad'] }), catalog).earned.has('estrellas-a'),
    ).toBe(false);
    expect(summarize(progress({ closed: 5 }), catalog).earned.get('anomalias')).toBe(1);
    expect(summarize(progress({ closed: 3 }), catalog).earned.has('anomalias')).toBe(false);
  });

  it('las tres posturas solo cuentan cuando se han usado todas', () => {
    expect(
      summarize(progress({ stances: ['concede', 'matiza'] }), catalog).earned.has('tres-posturas'),
    ).toBe(false);
    expect(
      summarize(progress({ stances: ['rebate', 'concede', 'matiza'] }), catalog).earned.get(
        'tres-posturas',
      ),
    ).toBe(1);
  });

  it('las fichas exigen haber jugado su anomalía y tener sus puntos', () => {
    const rich = progress({
      moves: ['da-razones', 'pone-ejemplo', 'distingue', 'contraejemplo'],
      choices: { d1: 'A' },
    });
    const s = summarize(rich, catalog);
    expect(s.points).toBe(40);
    expect(s.fichas).toEqual(['d1-lunas', 'd1-1992']);
    expect(summarize(progress({ moves: ['da-razones', 'pone-ejemplo'] }), catalog).fichas).toEqual(
      [],
    );
  });
});

describe('newlyEarned', () => {
  it('anuncia logros nuevos, repetidos, estrellas, rangos y fichas', () => {
    const before = summarize(progress({ moves: ['da-razones'], choices: { d1: 'A' } }), catalog);
    const after = summarize(
      progress({
        moves: ['da-razones', 'da-razones', 'pone-ejemplo', 'distingue', 'contraejemplo'],
        concepts: ['dignidad'],
        choices: { d1: 'A' },
      }),
      catalog,
    );
    const news = newlyEarned(before, after, rewards);
    expect(news).toContainEqual({ kind: 'logro', id: 'da-razones', points: 3 });
    expect(news).toContainEqual({ kind: 'logro', id: 'pone-ejemplo', points: 10 });
    expect(news).toContainEqual({ kind: 'estrella', id: 'dignidad', points: 5 });
    expect(news).toContainEqual({ kind: 'rango', id: 'cronista', label: 'Cronista' });
    expect(news.filter((n) => n.kind === 'ficha').map((n) => n.id)).toEqual([
      'd1-lunas',
      'd1-1992',
    ]);
  });

  it('sin cambios no hay avisos', () => {
    const s = summarize(progress({ moves: ['da-razones'] }), catalog);
    expect(newlyEarned(s, s, rewards)).toEqual([]);
  });
});
