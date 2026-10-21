import { describe, expect, it } from 'vitest';
import { mentionsDistress, scrubPersonalData } from './privacy.ts';

describe('scrubPersonalData', () => {
  it('quita correos, enlaces, teléfonos y usuarios de redes', () => {
    expect(scrubPersonalData('Escríbeme a ana.perez@gmail.com o mira www.ejemplo.es/x')).toBe(
      'Escríbeme a [correo] o mira [enlace]',
    );
    expect(scrubPersonalData('Mi móvil es 612 34 56 78 y el fijo +34 928-123-456')).toBe(
      'Mi móvil es [teléfono] y el fijo [teléfono]',
    );
    expect(scrubPersonalData('Sígueme en @cronista_77')).toBe('Sígueme en [usuario]');
  });

  it('no toca años, cifras ni argumentos normales', () => {
    const text = 'Entre 1633 y 1638 Galileo siguió trabajando: 2077 - 1633 = 444 años.';
    expect(scrubPersonalData(text)).toBe(text);
  });
});

describe('mentionsDistress', () => {
  const terms = ['me quiero morir', 'autolesi', 'suicid'];
  it('detecta los términos aunque cambien tildes, mayúsculas o letras repetidas', () => {
    expect(mentionsDistress('A veces ME QUIERO MORIIIR', terms)).toBe(true);
    expect(mentionsDistress('pienso en autolesionarme', terms)).toBe(true);
  });
  it('no salta con un argumento normal', () => {
    expect(mentionsDistress('Galileo debería salvar su vida para seguir investigando', terms)).toBe(
      false,
    );
  });
});
