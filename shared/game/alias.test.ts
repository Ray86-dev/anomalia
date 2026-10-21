import { describe, expect, it } from 'vitest';
import { aliasProblem, canonical, cleanAlias, type BlockedTerms } from './alias.ts';

const blocked: BlockedTerms = { contiene: ['mierda', 'puta'], exactas: ['culo', 'coño'] };

describe('aliasProblem', () => {
  it('acepta alias válidos con tildes, ñ, números, guiones y guion bajo', () => {
    for (const alias of ['Galileo', 'Ñandú_7', 'cronista-42', 'Ada', 'Hipatia_de_Alej']) {
      expect(aliasProblem(alias, blocked)).toBeNull();
    }
  });

  it('rechaza formatos no válidos', () => {
    for (const alias of ['ab', 'diecisietecaracts', 'con espacio', 'emoji🙂', 'punto.final', '']) {
      expect(aliasProblem(alias, blocked)).toBe('format');
    }
  });

  it('bloquea términos «contiene» aunque estén camuflados', () => {
    for (const alias of ['MIERDA', 'm1erda_x', 'pu7a', 'superpuuuta', 'xx-puta-xx']) {
      expect(aliasProblem(alias, blocked)).toBe('blocked');
    }
  });

  it('bloquea términos «exactas» solo como palabra completa o trozo', () => {
    for (const alias of ['Culo', 'cul0', 'Culo99', 'mi_culo', 'Coño', 'cono']) {
      expect(aliasProblem(alias, blocked)).toBe('blocked');
    }
    for (const alias of ['Calculo', 'Vehiculo', 'Icono']) {
      expect(aliasProblem(alias, blocked)).toBeNull();
    }
  });
});

describe('canonical y cleanAlias', () => {
  it('normaliza tildes, leet y repeticiones', () => {
    expect(canonical('Pííítaaa')).toBe('pita');
    expect(canonical('G4l1l30')).toBe('galileo');
  });

  it('unifica la forma Unicode para que el CHECK de la base de datos acepte la «ñ»', () => {
    const decomposed = 'Peña'; // n + tilde combinable
    expect(cleanAlias(`  ${decomposed} `)).toBe('Peña');
  });
});
