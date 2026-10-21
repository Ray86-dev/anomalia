-- ANOMALÍA · M1: avance de la partida (fases, decisión, justificación y réplica)
--
-- La Edge Function `partida` valida y calcula con shared/game; estas funciones solo
-- aplican el cambio de forma atómica comprobando la fase esperada (si no coincide → 'stale').
-- Todas devuelven el estado resultante para que el cliente lo adopte sin otra consulta.

-- Estado completo de un jugador (para la Edge Function, nunca expuesto al cliente).
create function private.player_state(p_player_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'playerId', p.id,
    'status', p.status,
    'chapter1', c.chapter_1,
    'chapter2', c.chapter_2,
    'chapterUnlocked', c.chapter_unlocked,
    'run', jsonb_build_object(
      'phase', r.phase,
      'currentDilemma', r.current_dilemma,
      'world', jsonb_build_object(
        'poder', r.poder,
        'responsabilidad', r.responsabilidad,
        'equidad', r.equidad,
        'confianza', r.confianza
      ),
      'branches', r.branches
    ),
    'answer', (
      select jsonb_build_object(
        'dilemmaId', a.dilemma_id,
        'choice', a.choice,
        'justification', a.justification,
        'objector', a.objector,
        'objection', a.objection,
        'reply', a.reply,
        'closing', a.closing
      )
      from public.answers a
      where a.player_id = r.player_id and a.dilemma_id = r.current_dilemma
    )
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.id = p_player_id;
$$;
revoke all on function private.player_state(uuid) from public;

-- Carga el estado de la sesión y registra la actividad. NULL si la sesión no se ha unido.
create function public.svc_load(p_auth_uid uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_player_id uuid;
begin
  update public.players set last_seen_at = now()
  where auth_uid = p_auth_uid
  returning id into v_player_id;
  if v_player_id is null then
    return null;
  end if;
  return private.player_state(v_player_id);
end $$;

-- «Continuar»: mueve la partida de `from` a `to` solo si sigue en `from`.
create function public.svc_advance(
  p_player_id uuid,
  p_from_phase text,
  p_from_dilemma text,
  p_to_phase text,
  p_to_dilemma text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.runs
  set phase = p_to_phase, current_dilemma = p_to_dilemma
  where player_id = p_player_id
    and phase = p_from_phase
    and current_dilemma is not distinct from p_from_dilemma;
  return jsonb_build_object(
    'status', case when found then 'ok' else 'stale' end,
    'state', private.player_state(p_player_id)
  );
end $$;

-- Decisión: registra la opción, aplica el nuevo estado del mundo y pasa a la justificación.
create function public.svc_choose(
  p_player_id uuid,
  p_dilemma text,
  p_choice text,
  p_poder smallint,
  p_responsabilidad smallint,
  p_equidad smallint,
  p_confianza smallint,
  p_branch text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'decision' and current_dilemma = p_dilemma
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  insert into public.answers (player_id, dilemma_id, choice)
  values (p_player_id, p_dilemma, p_choice)
  on conflict (player_id, dilemma_id) do update set choice = excluded.choice, chosen_at = now();

  update public.runs
  set poder = p_poder,
      responsabilidad = p_responsabilidad,
      equidad = p_equidad,
      confianza = p_confianza,
      branches = case
        when p_branch is null or p_branch = any (branches) then branches
        else array_append(branches, p_branch)
      end,
      phase = 'justification'
  where player_id = p_player_id;

  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

-- Justificación: guarda el texto y la objeción (IA o respaldo) y pasa a la objeción.
create function public.svc_justify(
  p_player_id uuid,
  p_dilemma text,
  p_text text,
  p_objector text,
  p_objection text,
  p_ai_source text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'justification' and current_dilemma = p_dilemma
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  update public.answers
  set justification = p_text,
      justified_at = now(),
      objector = p_objector,
      objection = p_objection,
      ai_source = p_ai_source
  where player_id = p_player_id and dilemma_id = p_dilemma;

  update public.runs set phase = 'objection' where player_id = p_player_id;
  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

-- Réplica: guarda la réplica y el cierre del consejero y pasa a las ondas temporales.
create function public.svc_reply(
  p_player_id uuid,
  p_dilemma text,
  p_text text,
  p_closing text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'objection' and current_dilemma = p_dilemma
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  update public.answers
  set reply = p_text,
      replied_at = now(),
      closing = p_closing,
      closed_at = now()
  where player_id = p_player_id and dilemma_id = p_dilemma;

  update public.runs set phase = 'ripples' where player_id = p_player_id;
  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

revoke all on function
  public.svc_load(uuid),
  public.svc_advance(uuid, text, text, text, text),
  public.svc_choose(uuid, text, text, smallint, smallint, smallint, smallint, text),
  public.svc_justify(uuid, text, text, text, text, text),
  public.svc_reply(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.svc_load(uuid),
  public.svc_advance(uuid, text, text, text, text),
  public.svc_choose(uuid, text, text, smallint, smallint, smallint, smallint, text),
  public.svc_justify(uuid, text, text, text, text, text),
  public.svc_reply(uuid, text, text, text)
to service_role;

-- my_state: añade la respuesta del dilema en curso (para reanudar a mitad de un dilema).
create or replace function public.my_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'player', jsonb_build_object('alias', p.alias, 'status', p.status),
    'class', jsonb_build_object(
      'label', c.label,
      'chapter1', c.chapter_1,
      'chapter2', c.chapter_2,
      'chapterUnlocked', c.chapter_unlocked
    ),
    'run', jsonb_build_object(
      'world', jsonb_build_object(
        'poder', r.poder,
        'responsabilidad', r.responsabilidad,
        'equidad', r.equidad,
        'confianza', r.confianza
      ),
      'branches', r.branches,
      'currentDilemma', r.current_dilemma,
      'phase', r.phase,
      'ending', r.ending,
      'finishedAt', r.finished_at
    ),
    'answer', (
      select jsonb_build_object(
        'dilemmaId', a.dilemma_id,
        'choice', a.choice,
        'justification', a.justification,
        'objector', a.objector,
        'objection', a.objection,
        'reply', a.reply,
        'closing', a.closing
      )
      from public.answers a
      where a.player_id = r.player_id and a.dilemma_id = r.current_dilemma
    )
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.auth_uid = (select auth.uid());
$$;
