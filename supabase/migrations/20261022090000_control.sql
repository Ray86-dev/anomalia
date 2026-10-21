-- ANOMALÍA · M3: Centro de Control, consola docente y recuperación de partidas
--
-- · Centro de Control: el proyector solo recibe un snapshot AGREGADO calculado aquí, con
--   umbral k = 5. Los resultados (decisiones, mundo, conceptos…) solo se recalculan cuando
--   hay ≥ k decisiones nuevas o el docente lo fuerza («revelar»), para que el cambio entre dos
--   snapshots nunca delate la decisión de una sola persona (D-08).
-- · Realtime: un trigger avisa por un canal privado «class:<id>» de que algo ha cambiado;
--   el aviso no lleva datos. El Centro vuelve a pedir el snapshot.
-- · Recuperación: clave de rescate (instantánea) o solicitud que aprueba el docente (D-33).

-- ─────────────────────────────────────────────────────────────────────────────
-- Clave de rescate
-- ─────────────────────────────────────────────────────────────────────────────

grant execute on function private.random_code(integer) to service_role;

alter table public.players add column rescue_key text;
update public.players set rescue_key = private.random_code(6) where rescue_key is null;
alter table public.players
  alter column rescue_key set default private.random_code(6),
  alter column rescue_key set not null,
  add constraint players_rescue_key_check check (rescue_key ~ '^[A-HJ-NP-Z2-9]{6}$');

-- Nadie lee la clave con un SELECT: el alumno la recibe de my_state(); el docente no la ve.
revoke select on public.players from authenticated;
grant select (id, auth_uid, class_id, alias, status, last_seen_at, created_at)
  on public.players to authenticated;

-- svc_join devuelve también la clave de rescate (para mostrarla al unirse).
create or replace function public.svc_join(p_auth_uid uuid, p_code text, p_alias text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_player public.players;
begin
  if exists (select 1 from public.teachers t where t.id = p_auth_uid) then
    return jsonb_build_object('status', 'is_teacher');
  end if;

  select * into v_class from public.classes c
  where c.code = upper(trim(p_code)) and c.expires_at > now();
  if not found then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  select * into v_player from public.players p where p.auth_uid = p_auth_uid;
  if not found then
    begin
      insert into public.players (auth_uid, class_id, alias, last_seen_at)
      values (p_auth_uid, v_class.id, p_alias, now())
      returning * into v_player;
      insert into public.runs (player_id) values (v_player.id);
      return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label,
        'resumed', false, 'rescueKey', v_player.rescue_key);
    exception
      when check_violation then
        return jsonb_build_object('status', 'alias_format');
      when unique_violation then
        select * into v_player from public.players p where p.auth_uid = p_auth_uid;
        if not found then
          return jsonb_build_object('status', 'alias_taken');
        end if;
    end;
  end if;

  if v_player.class_id <> v_class.id then
    return jsonb_build_object('status', 'already_in_other_class');
  end if;
  if v_player.status = 'expelled' then
    return jsonb_build_object('status', 'expelled');
  end if;
  update public.players set last_seen_at = now() where id = v_player.id;
  return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label,
    'resumed', true, 'rescueKey', v_player.rescue_key);
end $$;

-- Recupera un alias desde otra sesión: con la clave, al instante; sin ella (o si es
-- incorrecta), queda una solicitud pendiente para el docente.
create function public.svc_recover(p_auth_uid uuid, p_code text, p_alias text, p_key text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class public.classes;
  v_player public.players;
begin
  if exists (select 1 from public.teachers t where t.id = p_auth_uid) then
    return jsonb_build_object('status', 'is_teacher');
  end if;
  select * into v_class from public.classes c
  where c.code = upper(trim(p_code)) and c.expires_at > now();
  if not found then
    return jsonb_build_object('status', 'invalid_code');
  end if;
  select * into v_player from public.players p
  where p.class_id = v_class.id and lower(p.alias) = lower(trim(p_alias));
  if not found then
    return jsonb_build_object('status', 'unknown_alias');
  end if;
  if v_player.status = 'expelled' then
    return jsonb_build_object('status', 'expelled');
  end if;
  if v_player.auth_uid = p_auth_uid then
    return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label);
  end if;
  if exists (select 1 from public.players p where p.auth_uid = p_auth_uid) then
    return jsonb_build_object('status', 'already_in_other_class');
  end if;

  if p_key is not null and upper(regexp_replace(p_key, '[^A-Za-z0-9]', '', 'g')) = v_player.rescue_key then
    update public.players set auth_uid = p_auth_uid, last_seen_at = now() where id = v_player.id;
    update public.recovery_requests set status = 'rejected', resolved_at = now()
    where player_id = v_player.id and status = 'pending';
    return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label);
  end if;

  insert into public.recovery_requests (player_id, new_auth_uid)
  select v_player.id, p_auth_uid
  where not exists (
    select 1 from public.recovery_requests r
    where r.player_id = v_player.id and r.new_auth_uid = p_auth_uid and r.status = 'pending'
  );
  return jsonb_build_object('status', case when p_key is null then 'pending' else 'wrong_key' end);
end $$;

revoke all on function public.svc_recover(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.svc_recover(uuid, text, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- my_state: clave de rescate (solo para su dueño) y solicitud de recuperación pendiente
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ¿Tiene esta sesión una solicitud de recuperación pendiente? (para la pantalla de espera)
create function public.my_recovery() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('alias', p.alias, 'status', r.status, 'createdAt', r.created_at)
  from public.recovery_requests r
  join public.players p on p.id = r.player_id
  where r.new_auth_uid = (select auth.uid())
  order by r.created_at desc
  limit 1;
$$;
revoke all on function public.my_recovery() from public, anon, authenticated;
grant execute on function public.my_recovery() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Consola docente (siempre con comprobación de propiedad de la clase)
-- ─────────────────────────────────────────────────────────────────────────────

-- Todo lo que la consola necesita de una clase, en una sola llamada.
create function public.class_console(p_class_id uuid) returns jsonb
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

create function public.resolve_recovery(p_request_id uuid, p_approve boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_request public.recovery_requests;
begin
  select q.* into v_request
  from public.recovery_requests q
  join public.players p on p.id = q.player_id
  where q.id = p_request_id and q.status = 'pending'
    and p.class_id in (select private.my_class_ids())
  for update of q;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not p_approve then
    update public.recovery_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  if exists (select 1 from public.players p where p.auth_uid = v_request.new_auth_uid) then
    update public.recovery_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
    return jsonb_build_object('status', 'session_in_use');
  end if;

  update public.players set auth_uid = v_request.new_auth_uid where id = v_request.player_id;
  update public.recovery_requests
  set status = case when id = p_request_id then 'approved' else 'rejected' end, resolved_at = now()
  where player_id = v_request.player_id and status = 'pending';
  return jsonb_build_object('status', 'approved');
end $$;

create function public.unlock_chapter(p_class_id uuid, p_chapter smallint) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_chapter not in (1, 2) then
    raise exception 'invalid_chapter' using errcode = '22023';
  end if;
  update public.classes set chapter_unlocked = p_chapter
  where id = p_class_id and teacher_id = (select auth.uid());
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Borra la clase y todo lo suyo, incluidas las sesiones anónimas de su alumnado.
create function public.delete_class(p_class_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sessions uuid[];
begin
  if p_class_id not in (select private.my_class_ids()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(array_agg(p.auth_uid), '{}') into v_sessions
  from public.players p where p.class_id = p_class_id and p.auth_uid is not null;
  delete from public.classes where id = p_class_id;
  delete from auth.users u where u.id = any (v_sessions) and u.is_anonymous;
end $$;

revoke all on function
  public.class_console(uuid),
  public.resolve_recovery(uuid, boolean),
  public.unlock_chapter(uuid, smallint),
  public.delete_class(uuid)
from public, anon, authenticated;
grant execute on function
  public.class_console(uuid),
  public.resolve_recovery(uuid, boolean),
  public.unlock_chapter(uuid, smallint),
  public.delete_class(uuid)
to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Centro de Control: snapshots agregados con k = 5
-- ─────────────────────────────────────────────────────────────────────────────

create table public.class_snapshots (
  class_id uuid primary key references public.classes on delete cascade,
  results jsonb not null default '{}'::jsonb,
  -- Decisiones incluidas en los resultados publicados (para publicar por lotes de ≥ k).
  results_answers integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.class_snapshots enable row level security; -- sin políticas: solo por RPC

-- Grupos pequeños no se muestran: 1–4 personas → NULL (el Centro pinta «<5»). 0 sí se muestra.
create function private.mask(p_count bigint, p_k integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_count > 0 and p_count < p_k then null else p_count::integer end;
$$;

-- Resultados de la clase: solo agregados y solo con al menos k personas detrás de cada cifra.
create function private.class_results(p_class_id uuid, p_k integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  with active_answers as (
    select a.*
    from public.answers a
    join public.players p on p.id = a.player_id
    where p.class_id = p_class_id and p.status = 'active'
  ),
  decided_runs as (
    select r.*
    from public.runs r
    join public.players p on p.id = r.player_id
    where p.class_id = p_class_id and p.status = 'active'
      and exists (select 1 from public.answers a where a.player_id = r.player_id)
  ),
  per_dilemma as (
    select dilemma_id, count(*) as n,
      count(*) filter (where choice = 'A') as a,
      count(*) filter (where choice = 'B') as b,
      count(*) filter (where choice = 'C') as c
    from active_answers group by dilemma_id
  ),
  concept_counts as (
    select concept, count(*) as n
    from active_answers, unnest(concepts) as concept
    group by concept
    order by count(*) desc, concept
    limit 16
  )
  select jsonb_build_object(
    'decisions', coalesce((
      select jsonb_object_agg(dilemma_id, case
        when n >= p_k then jsonb_build_object('n', n, 'A', a, 'B', b, 'C', c)
        else jsonb_build_object('n', null)
      end)
      from per_dilemma
    ), '{}'::jsonb),
    'world', (
      select case when count(*) >= p_k then jsonb_build_object(
        'n', count(*),
        'poder', round(avg(poder)),
        'responsabilidad', round(avg(responsabilidad)),
        'equidad', round(avg(equidad)),
        'confianza', round(avg(confianza)),
        'desnivel', round(avg(poder - responsabilidad))
      ) end
      from decided_runs
    ),
    'concepts', case
      when (select count(*) from active_answers) >= p_k then coalesce(
        (select jsonb_agg(jsonb_build_object('id', concept, 'n', n)) from concept_counts), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'endings', (
      select case when sum(n) >= p_k then jsonb_object_agg(ending, n) end
      from (
        select r.ending, count(*) as n
        from public.runs r join public.players p on p.id = r.player_id
        where p.class_id = p_class_id and p.status = 'active' and r.ending is not null
        group by r.ending
      ) e
    )
  );
$$;
revoke all on function private.mask(bigint, integer), private.class_results(uuid, integer) from public;

create function public.class_snapshot(p_class_id uuid, p_force boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  k constant integer := 5;
  v_class public.classes;
  v_answers integer;
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
    insert into public.class_snapshots (class_id, results, results_answers, updated_at)
    values (p_class_id, v_results, v_answers, now())
    on conflict (class_id) do update
      set results = excluded.results, results_answers = excluded.results_answers,
          updated_at = excluded.updated_at;
  else
    v_results := v_snapshot.results;
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
    'pendingAnswers', v_answers - coalesce(v_snapshot.results_answers, 0)
  );
end $$;

revoke all on function public.class_snapshot(uuid, boolean) from public, anon, authenticated;
grant execute on function public.class_snapshot(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: aviso (sin datos) al canal privado de la clase cuando cambia algo
-- ─────────────────────────────────────────────────────────────────────────────

create function private.notify_class_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_class uuid;
begin
  if tg_table_name = 'players' then
    v_class := coalesce(new.class_id, old.class_id);
  else
    select p.class_id into v_class from public.players p
    where p.id = coalesce(new.player_id, old.player_id);
  end if;
  if v_class is not null then
    -- Un fallo al avisar nunca debe romper la escritura del alumno: el Centro también sondea.
    begin
      perform realtime.send(jsonb_build_object('at', now()), 'changed', 'class:' || v_class::text, true);
    exception when others then
      null;
    end;
  end if;
  return null;
end $$;
revoke all on function private.notify_class_change() from public;

create trigger runs_notify after insert or update on public.runs
  for each row execute function private.notify_class_change();
create trigger answers_notify after insert or update or delete on public.answers
  for each row execute function private.notify_class_change();
create trigger players_notify after insert or delete or update of status on public.players
  for each row execute function private.notify_class_change();

-- Solo el docente de la clase puede escuchar su canal privado.
create policy class_channel_teacher on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      select 'class:' || c.id::text from public.classes c where c.teacher_id = (select auth.uid())
    )
  );
