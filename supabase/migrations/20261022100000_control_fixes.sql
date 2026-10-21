-- ANOMALÍA · M3 (correcciones)
-- · Las alertas guardan el texto que las provocó: si la IA pide reescribir una justificación
--   («vacía»), la alerta se registra igualmente y el docente puede leer ese texto aunque el
--   alumno lo cambie después.
-- · class_snapshot: «pendingAnswers» se calcula después de publicar el lote.

alter table public.alerts add column text text check (char_length(text) <= 1200);

-- Registra una alerta sin cambiar la fase (justificación devuelta para reescribir).
create function public.svc_alert(p_player_id uuid, p_dilemma text, p_text text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.alerts (answer_id, class_id, text)
  select a.id, p.class_id, left(p_text, 1200)
  from public.answers a
  join public.players p on p.id = a.player_id
  where a.player_id = p_player_id and a.dilemma_id = p_dilemma;
end $$;
revoke all on function public.svc_alert(uuid, text, text) from public, anon, authenticated;
grant execute on function public.svc_alert(uuid, text, text) to service_role;

create or replace function public.class_console(p_class_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p_class_id not in (select private.my_class_ids()) then null else jsonb_build_object(
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', p.id,
        'alias', p.alias,
        'status', p.status,
        'phase', r.phase,
        'currentDilemma', r.current_dilemma,
        'lastSeenAt', p.last_seen_at,
        'finished', r.finished_at is not null
      ) order by lower(p.alias))
      from public.players p
      left join public.runs r on r.player_id = p.id
      where p.class_id = p_class_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'alias', p.alias, 'createdAt', q.created_at)
        order by q.created_at)
      from public.recovery_requests q
      join public.players p on p.id = q.player_id
      where p.class_id = p_class_id and q.status = 'pending'
    ), '[]'::jsonb),
    -- D-03: el docente solo lee textos del alumnado en las alertas (y al verificar un PDF).
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', al.id,
        'createdAt', al.created_at,
        'seenAt', al.seen_at,
        'alias', p.alias,
        'dilemmaId', a.dilemma_id,
        'text', al.text,
        'justification', a.justification,
        'reply', a.reply
      ) order by al.created_at desc)
      from public.alerts al
      join public.answers a on a.id = al.answer_id
      join public.players p on p.id = a.player_id
      where al.class_id = p_class_id
    ), '[]'::jsonb)
  ) end;
$$;

create or replace function public.class_snapshot(p_class_id uuid, p_force boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  k constant integer := 5;
  v_class public.classes;
  v_answers integer;
  v_published integer;
  v_snapshot public.class_snapshots;
  v_results jsonb;
  v_live jsonb;
begin
  select * into v_class from public.classes c
  where c.id = p_class_id and c.teacher_id = (select auth.uid());
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- En directo: conexión y progreso. No revela decisiones; los grupos < k van enmascarados.
  with active_runs as (
    select r.phase, r.current_dilemma, p.last_seen_at
    from public.players p join public.runs r on r.player_id = p.id
    where p.class_id = p_class_id and p.status = 'active'
  ),
  done as (
    select a.dilemma_id, count(*) as n
    from public.answers a join public.players p on p.id = a.player_id
    where p.class_id = p_class_id and p.status = 'active' and a.closed_at is not null
    group by a.dilemma_id
  )
  select jsonb_build_object(
    'players', (select count(*) from active_runs),
    'connected', (select count(*) from active_runs where last_seen_at > now() - interval '3 minutes'),
    'phases', jsonb_build_object(
      'prologue', private.mask((select count(*) from active_runs where phase = 'prologue'), k),
      'waiting', private.mask((select count(*) from active_runs where phase = 'waiting'), k),
      'final', private.mask((select count(*) from active_runs
        where phase in ('epilogue', 'reflection', 'dossier', 'done')), k)
    ),
    'dilemmas', coalesce((
      select jsonb_object_agg(d.id, jsonb_build_object(
        'here', private.mask((select count(*) from active_runs r where r.current_dilemma = d.id
          and r.phase not in ('prologue', 'waiting', 'epilogue', 'reflection', 'dossier', 'done')), k),
        'done', private.mask(coalesce((select n from done where done.dilemma_id = d.id), 0), k)
      ))
      from unnest(v_class.chapter_1 || v_class.chapter_2) as d(id)
    ), '{}'::jsonb)
  ) into v_live;

  -- Resultados: se recalculan por lotes de ≥ k decisiones nuevas (o al revelar).
  select count(*) into v_answers
  from public.answers a join public.players p on p.id = a.player_id
  where p.class_id = p_class_id and p.status = 'active';

  select * into v_snapshot from public.class_snapshots s where s.class_id = p_class_id for update;
  if not found or p_force or v_answers - v_snapshot.results_answers >= k
     or v_answers < v_snapshot.results_answers then
    v_results := private.class_results(p_class_id, k);
    v_published := v_answers;
    insert into public.class_snapshots (class_id, results, results_answers, updated_at)
    values (p_class_id, v_results, v_answers, now())
    on conflict (class_id) do update
      set results = excluded.results, results_answers = excluded.results_answers,
          updated_at = excluded.updated_at;
  else
    v_results := v_snapshot.results;
    v_published := v_snapshot.results_answers;
  end if;

  return jsonb_build_object(
    'k', k,
    'generatedAt', now(),
    'label', v_class.label,
    'chapter1', v_class.chapter_1,
    'chapter2', v_class.chapter_2,
    'chapterUnlocked', v_class.chapter_unlocked,
    'live', v_live,
    'results', v_results,
    'pendingAnswers', v_answers - v_published
  );
end $$;
