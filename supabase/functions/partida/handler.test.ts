import { describe, expect, it, vi } from 'vitest';
import { handlePartida, type PartidaDeps } from './handler.ts';

const ORIGIN = 'https://ray86-dev.github.io';
const UID = '00000000-0000-4000-8000-000000000001';

function deps(overrides: Partial<PartidaDeps> = {}): PartidaDeps {
  return {
    verifyUser: (jwt) => Promise.resolve(jwt === 'valid-token' ? UID : null),
    rpc: vi.fn(() =>
      Promise.resolve({ status: 'ok', alias: 'Galileo', classLabel: '4.º ESO B', resumed: false }),
    ),
    blockedTerms: { contiene: ['mierda'], exactas: ['culo'] },
    allowedOrigins: [ORIGIN],
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.supabase.co/functions/v1/partida', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const join = (classCode: string, alias: string) => ({ action: 'join', classCode, alias });

describe('partida · protocolo', () => {
  it('responde al preflight CORS de un origen permitido', async () => {
    const res = await handlePartida(
      new Request('https://x/partida', {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN, 'Access-Control-Request-Headers': 'authorization, apikey' },
      }),
      deps(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('authorization, apikey');
  });

  it('rechaza orígenes no permitidos', async () => {
    const res = await handlePartida(
      post(join('PRUEBA', 'Galileo'), { Origin: 'https://evil.example' }),
      deps(),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('exige una sesión válida', async () => {
    expect(
      (await handlePartida(post(join('PRUEBA', 'Galileo'), { Authorization: '' }), deps())).status,
    ).toBe(401);
    expect(
      (
        await handlePartida(
          post(join('PRUEBA', 'Galileo'), { Authorization: 'Bearer otro' }),
          deps(),
        )
      ).status,
    ).toBe(401);
  });

  it('rechaza cuerpos que no cumplen el contrato', async () => {
    for (const body of ['no-json', { action: 'hack' }, { action: 'join', classCode: 'PRUEBA' }]) {
      expect((await handlePartida(post(body), deps())).status).toBe(400);
    }
  });

  it('devuelve 500 sin filtrar detalles si la base de datos falla', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handlePartida(
      post(join('PRUEBA', 'Galileo')),
      deps({ rpc: () => Promise.reject(new Error('db down')) }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server_error' });
  });
});

describe('partida · join', () => {
  it('normaliza código y alias antes de llamar a svc_join', async () => {
    const d = deps();
    const res = await handlePartida(post(join(' pru-eba ', ' Peña ')), d);
    expect(res.status).toBe(200);
    expect(d.rpc).toHaveBeenCalledWith('svc_join', {
      p_auth_uid: UID,
      p_code: 'PRUEBA',
      p_alias: 'Peña',
    });
    expect(await res.json()).toEqual({
      ok: true,
      alias: 'Galileo',
      classLabel: '4.º ESO B',
      resumed: false,
    });
  });

  it('descarta códigos imposibles sin consultar la base de datos', async () => {
    const d = deps();
    const res = await handlePartida(post(join('PRUEB0', 'Galileo')), d);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_code' });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it('valida el alias (formato y lista de bloqueo) antes de consultar la base de datos', async () => {
    const d = deps();
    expect(await (await handlePartida(post(join('PRUEBA', 'ab')), d)).json()).toEqual({
      ok: false,
      error: 'alias_format',
    });
    expect(await (await handlePartida(post(join('PRUEBA', 'Culo99')), d)).json()).toEqual({
      ok: false,
      error: 'alias_blocked',
    });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it('traslada los errores de dominio de svc_join', async () => {
    const res = await handlePartida(
      post(join('PRUEBA', 'Galileo')),
      deps({ rpc: () => Promise.resolve({ status: 'alias_taken' }) }),
    );
    expect(await res.json()).toEqual({ ok: false, error: 'alias_taken' });
  });

  it('trata como error de servidor una respuesta inesperada de svc_join', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handlePartida(
      post(join('PRUEBA', 'Galileo')),
      deps({ rpc: () => Promise.resolve({ status: 'hacked' }) }),
    );
    expect(res.status).toBe(500);
  });
});
