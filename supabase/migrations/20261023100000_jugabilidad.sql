-- ANOMALÍA · M6 (jugabilidad)
-- · Fases nuevas en cada dilema: «lab» (laboratorio, entre la escena y el Consejo) y «twist»
--   (giro, entre la decisión y la justificación).
-- · Decisión en dos pasos: svc_pick guarda una elección provisional (runs.pending_choice) sin
--   crear la respuesta ni tocar el mundo; svc_confirm aplica los deltas una sola vez y crea la
--   respuesta. Así el Centro de Control nunca cuenta decisiones provisionales (D-08).
-- · Réplica guiada (reply_stance), movimientos filosóficos detectados por la IA (moves),
--   laboratorios completados (labs) y emblema del cronista (emblem).
-- · Progreso de la partida (private.run_progress) en cada respuesta de `partida`, para que el
--   móvil calcule logros, estrellas y recompensas al momento.

-- ── Partida ──

alter table public.runs drop constraint runs_phase_check;
alter table public.runs add constraint runs_phase_check check (phase in (
  'prologue', 'waiting', 'epilogue', 'reflection', 'dossier', 'done',
  'travel', 'scene', 'lab', 'council', 'decision', 'twist',
  'justification', 'objection', 'ripples', 'archive'
));

alter table public.runs
  add column pending_choice char(1) check (pending_choice in ('A', 'B', 'C')),
  add column labs text[] not null default '{}',
  add column emblem text check (emblem ~ '^[a-z0-9-]{1,24}:[a-z0-9-]{1,24}$'),
  add constraint runs_twist_pending_check check ((phase = 'twist') = (pending_choice is not null));

-- ── Respuestas ──

alter table public.answers
  add column first_choice char(1) check (first_choice in ('A', 'B', 'C')),
  add column changed boolean generated always as (first_choice <> choice) stored,
  add column reply_stance text check (reply_stance in ('concede', 'matiza', 'rebate')),
  add column moves text[] not null default '{}' check (cardinality(moves) <= 12);

-- El Centro solo necesita saber de cambios que afectan a lo que muestra: el emblema no avisa.
drop trigger runs_notify on public.runs;
create trigger runs_notify
  after insert or update of phase, current_dilemma, poder, responsabilidad, equidad, confianza,
    ending, finished_at
  on public.runs
  for each row execute function private.notify_class_change();

-- ── Progreso de la partida (logros, estrellas y recompensas se calculan con shared/game) ──

create function private.run_progress(p_player_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'classDilemmas', to_jsonb(c.chapter_1 || c.chapter_2),
    'labs', to_jsonb(r.labs),
    'choices', coalesce((
      select jsonb_object_agg(a.dilemma_id, a.choice)
      from public.answers a where a.player_id = p.id
    ), '{}'::jsonb),
    'concepts', coalesce((
      select jsonb_agg(distinct concept)
      from public.answers a, unnest(a.concepts) as concept
      where a.player_id = p.id
    ), '[]'::jsonb),
    'moves', coalesce((
      select jsonb_agg(m.move order by a.chosen_at, m.position)
      from public.answers a, unnest(a.moves) with ordinality as m(move, position)
      where a.player_id = p.id
    ), '[]'::jsonb),
    'stances', coalesce((
      select jsonb_agg(a.reply_stance order by a.chosen_at)
      from public.answers a where a.player_id = p.id and a.reply_stance is not null
    ), '[]'::jsonb),
    'changed', (select count(*) from public.answers a where a.player_id = p.id and a.changed),
    'kept', (select count(*) from public.answers a where a.player_id = p.id and not a.changed),
    'closed', (
      select count(*) from public.answers a where a.player_id = p.id and a.closed_at is not null
    ),
    'finished', r.finished_at is not null
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.id = p_player_id;
$$;
revoke all on function private.run_progress(uuid) from public, anon, authenticated;

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
      'branches', r.branches,
      'ending', r.ending,
      'pendingChoice', r.pending_choice,
      'emblem', r.emblem,
      'progress', private.run_progress(p.id)
    ),
    'answer', (
      select jsonb_build_object(
        'dilemmaId', a.dilemma_id,
        'choice', a.choice,
        'firstChoice', a.first_choice,
        'justification', a.justification,
        'objector', a.objector,
        'objection', a.objection,
        'reply', a.reply,
        'replyStance', a.reply_stance,
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
    'player', jsonb_build_object('alias', p.alias, 'status', p.status, 'rescueKey', p.rescue_key),
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
      'finishedAt', r.finished_at,
      'pendingChoice', r.pending_choice,
      'emblem', r.emblem,
      'progress', private.run_progress(p.id)
    ),
    'answer', (
      select jsonb_build_object(
        'dilemmaId', a.dilemma_id,
        'choice', a.choice,
        'firstChoice', a.first_choice,
        'justification', a.justification,
        'objector', a.objector,
        'objection', a.objection,
        'reply', a.reply,
        'replyStance', a.reply_stance,
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

-- ── «Continuar»: al salir del laboratorio queda registrado ──

create or replace function public.svc_advance(
  p_player_id uuid,
  p_from_phase text,
  p_from_dilemma text,
  p_to_phase text,
  p_to_dilemma text,
  p_ending text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.runs
  set phase = p_to_phase,
      current_dilemma = p_to_dilemma,
      ending = case when p_to_phase = 'epilogue' then coalesce(p_ending, ending) else ending end,
      labs = case
        when p_from_phase = 'lab' and p_from_dilemma is not null
          and not (p_from_dilemma = any (labs)) then array_append(labs, p_from_dilemma)
        else labs
      end
  where player_id = p_player_id
    and phase = p_from_phase
    and current_dilemma is not distinct from p_from_dilemma;
  return jsonb_build_object(
    'status', case when found then 'ok' else 'stale' end,
    'state', private.player_state(p_player_id)
  );
end $$;

-- ── Decisión en dos pasos ──

drop function public.svc_choose(uuid, text, text, smallint, smallint, smallint, smallint, text);

-- Elección provisional: pasa al giro sin crear la respuesta ni tocar el mundo.
create function public.svc_pick(p_player_id uuid, p_dilemma text, p_choice text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.runs
  set pending_choice = p_choice, phase = 'twist'
  where player_id = p_player_id and phase = 'decision' and current_dilemma = p_dilemma;
  return jsonb_build_object(
    'status', case when found then 'ok' else 'stale' end,
    'state', private.player_state(p_player_id)
  );
end $$;

-- Decisión definitiva tras el giro. La guarda del UPDATE hace que un doble toque sea «stale»
-- y que los deltas (calculados por `partida` con el mundo previo) se apliquen una sola vez.
create function public.svc_confirm(
  p_player_id uuid,
  p_dilemma text,
  p_first_choice text,
  p_choice text,
  p_poder smallint,
  p_responsabilidad smallint,
  p_equidad smallint,
  p_confianza smallint,
  p_branch text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.runs
  set poder = p_poder,
      responsabilidad = p_responsabilidad,
      equidad = p_equidad,
      confianza = p_confianza,
      branches = case
        when p_branch is null or p_branch = any (branches) then branches
        else array_append(branches, p_branch)
      end,
      pending_choice = null,
      phase = 'justification'
  where player_id = p_player_id
    and phase = 'twist'
    and current_dilemma = p_dilemma
    and pending_choice = p_first_choice;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  insert into public.answers (player_id, dilemma_id, choice, first_choice)
  values (p_player_id, p_dilemma, p_choice, p_first_choice)
  on conflict (player_id, dilemma_id) do update
    set choice = excluded.choice, first_choice = excluded.first_choice, chosen_at = now();

  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

-- Emblema del cronista (cosmético): `partida` comprueba que la pieza está desbloqueada.
create function public.svc_emblem(p_player_id uuid, p_emblem text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.runs set emblem = p_emblem where player_id = p_player_id;
  return jsonb_build_object(
    'status', case when found then 'ok' else 'stale' end,
    'state', private.player_state(p_player_id)
  );
end $$;

-- ── Justificación y réplica: movimientos detectados y postura ──

drop function public.svc_justify(uuid, text, text, text, text, text, text, text[], boolean);
drop function public.svc_reply(uuid, text, text, text, text[], boolean);

create function public.svc_justify(
  p_player_id uuid,
  p_dilemma text,
  p_text text,
  p_objector text,
  p_objection text,
  p_ai_source text,
  p_quality text,
  p_concepts text[],
  p_moves text[],
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
      concepts = array(select distinct c from unnest(a.concepts || coalesce(p_concepts, '{}')) c),
      moves = (a.moves || coalesce(p_moves, '{}'))[1:12]
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
  p_stance text,
  p_closing text,
  p_concepts text[],
  p_moves text[],
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
      reply_stance = p_stance,
      replied_at = now(),
      closing = p_closing,
      closed_at = now(),
      concepts = array(select distinct c from unnest(a.concepts || coalesce(p_concepts, '{}')) c),
      moves = (a.moves || coalesce(p_moves, '{}'))[1:12]
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

-- ── Expediente: primera elección, postura, emblema y progreso ──

create or replace function private.run_answers(p_player_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'dilemmaId', a.dilemma_id,
    'choice', a.choice,
    'firstChoice', a.first_choice,
    'justification', a.justification,
    'objector', a.objector,
    'objection', a.objection,
    'reply', a.reply,
    'replyStance', a.reply_stance
  ) order by a.chosen_at), '[]'::jsonb)
  from public.answers a
  where a.player_id = p_player_id;
$$;

create or replace function public.my_dossier() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'alias', p.alias,
    'classLabel', c.label,
    'verifyCode', r.verify_code,
    'ending', r.ending,
    'finishedAt', r.finished_at,
    'world', jsonb_build_object(
      'poder', r.poder,
      'responsabilidad', r.responsabilidad,
      'equidad', r.equidad,
      'confianza', r.confianza
    ),
    'reflection', r.final_reflection,
    'emblem', r.emblem,
    'progress', private.run_progress(p.id),
    'answers', private.run_answers(p.id)
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.id = private.my_player_id()
    and r.phase in ('epilogue', 'reflection', 'dossier', 'done');
$$;

-- ── Permisos: las svc_* solo las ejecuta `partida` (service_role) ──

revoke all on function
  public.svc_pick(uuid, text, text),
  public.svc_confirm(uuid, text, text, text, smallint, smallint, smallint, smallint, text),
  public.svc_emblem(uuid, text),
  public.svc_justify(uuid, text, text, text, text, text, text, text[], text[], boolean),
  public.svc_reply(uuid, text, text, text, text, text[], text[], boolean)
from public, anon, authenticated;
grant execute on function
  public.svc_pick(uuid, text, text),
  public.svc_confirm(uuid, text, text, text, smallint, smallint, smallint, smallint, text),
  public.svc_emblem(uuid, text),
  public.svc_justify(uuid, text, text, text, text, text, text, text[], text[], boolean),
  public.svc_reply(uuid, text, text, text, text, text[], text[], boolean)
to service_role;
