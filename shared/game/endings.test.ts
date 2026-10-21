import { describe, expect, it } from 'vitest';
import { endings } from '../generated/content.ts';
import { computeEnding, type EndingRule } from './endings.ts';
import { INITIAL_WORLD, type WorldState } from './world.ts';

const world = (partial: Partial<WorldState>): WorldState => ({ ...INITIAL_WORLD, ...partial });

describe('computeEnding (evaluador genérico)', () => {
  const rules: EndingRule[] = [
    { id: 'alto', condicion: { todas: [{ var: 'poder', op: '>=', valor: 70 }] } },
    {
      id: 'doble',
      condicion: {
        todas: [
          { var: 'equidad', op: '>', valor: 60 },
          { var: 'confianza', op: '<=', valor: 40 },
        ],
      },
    },
    { id: 'resto', condicion: null },
  ];

  it('gana la primera regla que se cumple', () => {
    expect(computeEnding(world({ poder: 80, equidad: 70, confianza: 30 }), rules).id).toBe('alto');
  });

  it('exige todas las comparaciones de la regla', () => {
    expect(computeEnding(world({ equidad: 70, confianza: 30 }), rules).id).toBe('doble');
    expect(computeEnding(world({ equidad: 70, confianza: 41 }), rules).id).toBe('resto');
  });

  it('respeta los límites de cada operador', () => {
    expect(computeEnding(world({ poder: 70 }), rules).id).toBe('alto');
    expect(computeEnding(world({ poder: 69 }), rules).id).toBe('resto');
    expect(computeEnding(world({ equidad: 60, confianza: 40 }), rules).id).toBe('resto');
  });

  it('falla si ningún final encaja (falta el final por defecto)', () => {
    expect(() => computeEnding(INITIAL_WORLD, rules.slice(0, 2))).toThrow();
  });
});

describe('computeEnding con los finales de content/finales.json (§5.6)', () => {
  const end = (partial: Partial<WorldState>) => computeEnding(world(partial), endings).id;

  it('Tecnocracia genómica: Desnivel ≥ 25 y EQUIDAD < 40', () => {
    expect(end({ poder: 80, responsabilidad: 50, equidad: 30 })).toBe('tecnocracia');
    expect(end({ poder: 75, responsabilidad: 50, equidad: 39 })).toBe('tecnocracia'); // Desnivel = 25
    expect(end({ poder: 74, responsabilidad: 50, equidad: 39 })).not.toBe('tecnocracia');
    expect(end({ poder: 80, responsabilidad: 50, equidad: 40 })).not.toBe('tecnocracia');
  });

  it('Era del cuidado: RESPONSABILIDAD ≥ 65 y EQUIDAD ≥ 60', () => {
    expect(end({ responsabilidad: 65, equidad: 60 })).toBe('cuidado');
    expect(end({ responsabilidad: 64, equidad: 60 })).not.toBe('cuidado');
  });

  it('Fractura: CONFIANZA < 35', () => {
    expect(end({ confianza: 34 })).toBe('fractura');
    expect(end({ confianza: 35 })).toBe('equilibrio');
  });

  it('Estancamiento: PODER < 35', () => {
    expect(end({ poder: 34 })).toBe('estancamiento');
  });

  it('Equilibrio frágil: resto de casos', () => {
    expect(end({})).toBe('equilibrio');
  });

  it('cuando se cumplen varias, gana el orden de la tabla (D-09)', () => {
    expect(end({ poder: 90, responsabilidad: 50, equidad: 20, confianza: 10 })).toBe('tecnocracia');
    expect(end({ responsabilidad: 70, equidad: 70, confianza: 10, poder: 20 })).toBe('cuidado');
    expect(end({ confianza: 20, poder: 20 })).toBe('fractura');
  });
});
