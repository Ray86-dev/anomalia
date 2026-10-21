-- ANOMALÍA · M2: IA (objeción y cierre), presupuesto de llamadas y alertas privadas
--
-- · svc_ai_take reserva una llamada de forma atómica: como mucho N por alumno y dilema
--   (objeción + cierre + un reintento) y nunca por encima del presupuesto de la clase.
-- · svc_justify / svc_reply guardan además la calidad, los conceptos (lista cerrada) y, si
--   hay indicios de malestar, una alerta que solo ve el docente.

-- Reserva una llamada a la IA. Devuelve el número de llamadas del alumno en este dilema
-- (1, 2…) o NULL si ya no quedan (límite por dilema o presupuesto de la clase agotado).
create function public.svc_ai_take(p_player_id uuid, p_dilemma text, p_max_calls integer)
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_calls integer;
begin
  update public.answers
  set ai_calls = ai_calls + 1
  where player_id = p_player_id and dilemma_id = p_dilemma and ai_calls < p_max_calls
  returning ai_calls into v_calls;
  if v_calls is null then
    return null;
  end if;

  update public.classes c
  set ai_calls_used = c.ai_calls_used + 1
  from public.players p
  where p.id = p_player_id and c.id = p.class_id and c.ai_calls_used < c.ai_budget;
  if not found then
    raise exception 'ai_budget_exhausted'; -- deshace también el contador del alumno
  end if;
  return v_calls;
exception
  when raise_exception then
    return null;
end $$;

drop function public.svc_justify(uuid, text, text, text, text, text);
drop function public.svc_reply(uuid, text, text, text);

create function public.svc_justify(
  p_player_id uuid,
  p_dilemma text,
  p_text text,
  p_objector text,
  p_objection text,
  p_ai_source text,
  p_quality text,
  p_concepts text[],
  p_alert boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_answer uuid;
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'justification' and current_dilemma = p_dilemma
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  update public.answers a
  set justification = p_text,
      justified_at = now(),
      objector = p_objector,
      objection = p_objection,
      ai_source = p_ai_source,
      quality = p_quality,
      concepts = array(select distinct c from unnest(a.concepts || coalesce(p_concepts, '{}')) c)
  where a.player_id = p_player_id and a.dilemma_id = p_dilemma
  returning a.id into v_answer;

  if p_alert then
    insert into public.alerts (answer_id, class_id)
    select v_answer, p.class_id from public.players p where p.id = p_player_id;
  end if;

  update public.runs set phase = 'objection' where player_id = p_player_id;
  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

create function public.svc_reply(
  p_player_id uuid,
  p_dilemma text,
  p_text text,
  p_closing text,
  p_concepts text[],
  p_alert boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_answer uuid;
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'objection' and current_dilemma = p_dilemma
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  update public.answers a
  set reply = p_text,
      replied_at = now(),
      closing = p_closing,
      closed_at = now(),
      concepts = array(select distinct c from unnest(a.concepts || coalesce(p_concepts, '{}')) c)
  where a.player_id = p_player_id and a.dilemma_id = p_dilemma
  returning a.id into v_answer;

  -- Una sola alerta por respuesta: si ya la marcó la justificación, no se duplica.
  if p_alert and not exists (select 1 from public.alerts al where al.answer_id = v_answer) then
    insert into public.alerts (answer_id, class_id)
    select v_answer, p.class_id from public.players p where p.id = p_player_id;
  end if;

  update public.runs set phase = 'ripples' where player_id = p_player_id;
  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

revoke all on function
  public.svc_ai_take(uuid, text, integer),
  public.svc_justify(uuid, text, text, text, text, text, text, text[], boolean),
  public.svc_reply(uuid, text, text, text, text[], boolean)
from public, anon, authenticated;

grant execute on function
  public.svc_ai_take(uuid, text, integer),
  public.svc_justify(uuid, text, text, text, text, text, text, text[], boolean),
  public.svc_reply(uuid, text, text, text, text[], boolean)
to service_role;

-- El estado devuelto incluye de dónde salió la objeción (IA o respaldo).
create or replace function private.player_state(p_player_id uuid) returns jsonb
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
        'closing', a.closing,
        'aiSource', a.ai_source
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
        'closing', a.closing,
        'aiSource', a.ai_source
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
