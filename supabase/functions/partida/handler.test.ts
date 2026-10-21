import { describe, expect, it, vi } from 'vitest';
import { dilemmas, fallbacks } from '../../../shared/generated/content.ts';
import type { SvcState } from '../../../shared/schemas/partida.ts';
import { handlePartida, type PartidaDeps } from './handler.ts';

const ORIGIN = 'https://ray86-dev.github.io';
const UID = '00000000-0000-4000-8000-000000000001';

function deps(overrides: Partial<PartidaDeps> = {}): PartidaDeps {
  return {
    verifyUser: (jwt) => Promise.resolve(jwt === 'valid-token' ? UID : null),
    rpc: vi.fn(() =>
      Promise.resolve({ status: 'ok', alias: 'Galileo', classLabel: '4.º ESO B', resumed: false }),
    ),
    content: {
      blockedTerms: { contiene: ['mierda'], exactas: ['culo'] },
      dilemmas: [],
      fallbacks: {},
    },
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

// ── Acciones de juego (M1) ──

type Run = SvcState['run'];

function loaded(run: Partial<Run> = {}, overrides: Partial<SvcState> = {}): SvcState {
  return {
    playerId: 'player-1',
    status: 'active',
    chapter1: ['d1', 'd2', 'd3'],
    chapter2: ['d4', 'd5'],
    chapterUnlocked: 1,
    run: {
      phase: 'prologue',
      currentDilemma: null,
      world: { poder: 50, responsabilidad: 50, equidad: 50, confianza: 50 },
      branches: [],
      ...run,
    },
    answer: null,
    ...overrides,
  };
}

/** rpc falso: svc_load devuelve `state`; las escrituras devuelven ok con el mismo estado. */
function gameDeps(state: SvcState | null) {
  const rpc = vi.fn<PartidaDeps['rpc']>((fn) =>
    Promise.resolve(fn === 'svc_load' ? state : { status: 'ok', state }),
  );
  return {
    rpc,
    deps: deps({
      rpc,
      content: { blockedTerms: { contiene: [], exactas: [] }, dilemmas, fallbacks },
    }),
  };
}

async function play(body: unknown, state: SvcState | null) {
  const { rpc, deps: d } = gameDeps(state);
  const res = await handlePartida(post(body), d);
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, rpc };
}

const writes = (rpc: ReturnType<typeof gameDeps>['rpc']) =>
  rpc.mock.calls.filter(([fn]) => fn !== 'svc_load');

describe('partida · advance', () => {
  it('avanza del prólogo al viaje a D1', async () => {
    const { body, rpc } = await play(
      { action: 'advance', from: { phase: 'prologue', dilemmaId: null } },
      loaded(),
    );
    expect(body.ok).toBe(true);
    expect(writes(rpc)).toEqual([
      [
        'svc_advance',
        {
          p_player_id: 'player-1',
          p_from_phase: 'prologue',
          p_from_dilemma: null,
          p_to_phase: 'travel',
          p_to_dilemma: 'd1',
        },
      ],
    ]);
  });

  it('responde stale si el cliente no está donde cree (doble toque)', async () => {
    const { body, rpc } = await play(
      { action: 'advance', from: { phase: 'travel', dilemmaId: 'd1' } },
      loaded({ phase: 'scene', currentDilemma: 'd1' }),
    );
    expect(body).toMatchObject({ ok: false, error: 'stale', run: { phase: 'scene' } });
    expect(writes(rpc)).toEqual([]);
  });

  it('no deja saltarse la decisión con «continuar»', async () => {
    const { body } = await play(
      { action: 'advance', from: { phase: 'decision', dilemmaId: 'd1' } },
      loaded({ phase: 'decision', currentDilemma: 'd1' }),
    );
    expect(body).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('en la espera responde locked mientras el capítulo II esté bloqueado', async () => {
    const { body } = await play(
      { action: 'advance', from: { phase: 'waiting', dilemmaId: null } },
      loaded({ phase: 'waiting' }),
    );
    expect(body).toMatchObject({ ok: false, error: 'locked' });
  });

  it('rechaza sesiones sin jugador o retiradas', async () => {
    const advance = { action: 'advance', from: { phase: 'prologue', dilemmaId: null } };
    expect((await play(advance, null)).body).toMatchObject({ ok: false, error: 'not_joined' });
    expect((await play(advance, loaded({}, { status: 'expelled' }))).body).toMatchObject({
      error: 'expelled',
    });
  });
});

describe('partida · choose / justify / reply', () => {
  it('aplica los deltas de la opción en el servidor y registra la rama', async () => {
    // D1 · B: CONFIANZA +10, PODER +5, rama d1-firme
    const { rpc } = await play(
      { action: 'choose', dilemmaId: 'd1', choice: 'B' },
      loaded({ phase: 'decision', currentDilemma: 'd1' }),
    );
    expect(writes(rpc)[0]).toEqual([
      'svc_choose',
      {
        p_player_id: 'player-1',
        p_dilemma: 'd1',
        p_choice: 'B',
        p_poder: 55,
        p_responsabilidad: 50,
        p_equidad: 50,
        p_confianza: 60,
        p_branch: 'd1-firme',
      },
    ]);
  });

  it('solo se elige en la fase de decisión del dilema en curso', async () => {
    const { body, rpc } = await play(
      { action: 'choose', dilemmaId: 'd1', choice: 'A' },
      loaded({ phase: 'justification', currentDilemma: 'd1' }),
    );
    expect(body).toMatchObject({ ok: false, error: 'stale' });
    expect(writes(rpc)).toEqual([]);
  });

  const afterChoice = (phase: Run['phase']) =>
    loaded(
      { phase, currentDilemma: 'd1' },
      {
        answer: {
          dilemmaId: 'd1',
          choice: 'A',
          justification: null,
          objector: null,
          objection: null,
          reply: null,
          closing: null,
        },
      },
    );

  it('guarda la justificación limpia y la objeción de respaldo del objetor de la opción', async () => {
    const { rpc } = await play(
      { action: 'justify', dilemmaId: 'd1', text: '  Porque la vida\u0000 importa  ' },
      afterChoice('justification'),
    );
    const d1A = dilemmas.find((d) => d.id === 'd1')?.opciones[0];
    expect(writes(rpc)[0]).toEqual([
      'svc_justify',
      {
        p_player_id: 'player-1',
        p_dilemma: 'd1',
        p_text: 'Porque la vida importa',
        p_objector: d1A?.objetor,
        p_objection: fallbacks.d1?.A?.[d1A?.objetor ?? '']?.objecion.normal,
        p_ai_source: 'respaldo',
      },
    ]);
  });

  it('rechaza textos sin ninguna palabra', async () => {
    const { body } = await play(
      { action: 'justify', dilemmaId: 'd1', text: ' … ¡! ' },
      afterChoice('justification'),
    );
    expect(body).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('guarda la réplica con el cierre de respaldo', async () => {
    const { rpc } = await play(
      { action: 'reply', dilemmaId: 'd1', text: 'No estoy de acuerdo' },
      afterChoice('objection'),
    );
    expect(writes(rpc)[0]?.[0]).toBe('svc_reply');
    expect(writes(rpc)[0]?.[1]).toMatchObject({ p_text: 'No estoy de acuerdo' });
  });
});
