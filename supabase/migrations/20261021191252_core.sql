-- ANOMALÍA · migración core (M0)
-- Tablas, RLS, funciones auxiliares y RPC básicas. Decisiones: docs/decisiones.md (D-03…D-13).
--
-- Modelo de seguridad
--   · Alumnado (sesión anónima con fila en players): solo SELECT de sus filas. Todas sus
--     escrituras pasan por la Edge Function `partida`, que llama a funciones svc_*
--     ejecutables únicamente por service_role.
--   · Docente (fila en teachers): lee sus clases y su alumnado; las mutaciones van por RPC
--     con comprobación de propiedad.
--   · anon (sin sesión): nada salvo ping().
--   · Seguro por defecto: las tablas y funciones nuevas de `public` no conceden nada a
--     anon/authenticated; cada permiso se da de forma explícita.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────────────────────

-- Lista blanca: ser docente = tener fila aquí (se añade con `npm run teacher:add`).
create table public.teachers (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  chapter_1 text[] not null,
  chapter_2 text[] not null default '{}',
  chapter_unlocked smallint not null default 1 check (chapter_unlocked in (1, 2)),
  ai_budget integer not null default 400 check (ai_budget >= 0),
  ai_calls_used integer not null default 0 check (ai_calls_used >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index classes_teacher_id_idx on public.classes (teacher_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid unique references auth.users on delete set null, -- se reasigna al recuperar
  class_id uuid not null references public.classes on delete cascade,
  alias text not null check (alias ~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_-]{3,16}$'),
  status text not null default 'active' check (status in ('active', 'expelled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index players_class_alias_key on public.players (class_id, lower(alias));

-- Una partida por alumno. Fases: shared/game/phases.ts.
create table public.runs (
  player_id uuid primary key references public.players on delete cascade,
  poder smallint not null default 50 check (poder between 0 and 100),
  responsabilidad smallint not null default 50 check (responsabilidad between 0 and 100),
  equidad smallint not null default 50 check (equidad between 0 and 100),
  confianza smallint not null default 50 check (confianza between 0 and 100),
  desnivel smallint generated always as (poder - responsabilidad) stored,
  branches text[] not null default '{}',
  current_dilemma text check (current_dilemma ~ '^d[0-9]+$'),
  phase text not null default 'prologue' check (phase in (
    'prologue', 'waiting', 'epilogue', 'reflection', 'dossier', 'done',
    'travel', 'scene', 'council', 'decision', 'justification', 'objection', 'ripples', 'archive'
  )),
  ending text,
  final_reflection text check (char_length(final_reflection) <= 3000),
  verify_code text unique check (verify_code ~ '^ANM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.runs on delete cascade,
  dilemma_id text not null check (dilemma_id ~ '^d[0-9]+$'),
  choice text not null check (choice in ('A', 'B', 'C')),
  justification text check (char_length(justification) <= 1200),
  objector text,
  objection text check (char_length(objection) <= 1200),
  reply text check (char_length(reply) <= 900),
  closing text check (char_length(closing) <= 1200),
  concepts text[] not null default '{}',
  quality text check (quality in ('vacia', 'basica', 'solida')),
  ai_source text check (ai_source in ('ia', 'respaldo')),
  ai_calls smallint not null default 0 check (ai_calls >= 0),
  chosen_at timestamptz not null default now(),
  justified_at timestamptz,
  replied_at timestamptz,
  closed_at timestamptz,
  unique (player_id, dilemma_id) -- idempotencia de «elegir»
);

-- Alertas de malestar (§7.2): solo las ve el docente; el alumno no sabe que existen.
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index alerts_answer_id_idx on public.alerts (answer_id);
create index alerts_class_id_idx on public.alerts (class_id);

create table public.recovery_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players on delete cascade,
  new_auth_uid uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index recovery_requests_player_id_idx on public.recovery_requests (player_id);
create index recovery_requests_new_auth_uid_idx on public.recovery_requests (new_auth_uid);

-- ─────────────────────────────────────────────────────────────────────────────
-- Funciones auxiliares (esquema private: PostgREST no lo expone)
-- ─────────────────────────────────────────────────────────────────────────────

create function private.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teachers t where t.id = (select auth.uid()));
$$;

create function private.my_class_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.classes c where c.teacher_id = (select auth.uid());
$$;

create function private.my_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p
  where p.auth_uid = (select auth.uid()) and p.status = 'active';
$$;

revoke all on function private.is_teacher(), private.my_class_ids(), private.my_player_id() from public;
grant execute on function private.is_teacher(), private.my_class_ids(), private.my_player_id() to authenticated;

-- Código aleatorio sin caracteres ambiguos (sin 0/O/1/I). 32 símbolos → sin sesgo con % 32.
create function private.random_code(p_length integer) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(s.b, i) % 32), 1), '' order by i)
  from (select extensions.gen_random_bytes(p_length) as b) s, generate_series(0, p_length - 1) as i;
$$;
revoke all on function private.random_code(integer) from public;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.touch_updated_at() from public;

create trigger runs_touch_updated_at before update on public.runs
  for each row execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS y permisos de tabla
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on public.teachers, public.classes, public.players, public.runs, public.answers,
  public.alerts, public.recovery_requests from anon, authenticated;

alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.players enable row level security;
alter table public.runs enable row level security;
alter table public.answers enable row level security;
alter table public.alerts enable row level security;
alter table public.recovery_requests enable row level security; -- sin políticas: solo por RPC

grant select on public.teachers, public.classes, public.players, public.runs, public.answers,
  public.alerts to authenticated;
grant update (alias, status) on public.players to authenticated; -- nunca auth_uid ni class_id
grant update (seen_at) on public.alerts to authenticated;

create policy teachers_select_self on public.teachers
  for select to authenticated
  using (id = (select auth.uid()));

-- Las mutaciones de classes van por RPC (D-12).
create policy classes_select_own on public.classes
  for select to authenticated
  using (teacher_id = (select auth.uid()));

create policy players_select_self_or_teacher on public.players
  for select to authenticated
  using (auth_uid = (select auth.uid()) or class_id in (select private.my_class_ids()));

create policy players_update_teacher on public.players
  for update to authenticated
  using (class_id in (select private.my_class_ids()))
  with check (class_id in (select private.my_class_ids()));

create policy runs_select_self on public.runs
  for select to authenticated
  using (player_id = (select private.my_player_id()));

create policy answers_select_self on public.answers
  for select to authenticated
  using (player_id = (select private.my_player_id()));

create policy alerts_select_teacher on public.alerts
  for select to authenticated
  using (class_id in (select private.my_class_ids()));

create policy alerts_update_teacher on public.alerts
  for update to authenticated
  using (class_id in (select private.my_class_ids()))
  with check (class_id in (select private.my_class_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC para usuarios autenticados
-- ─────────────────────────────────────────────────────────────────────────────

-- Alumno: su partida y los ajustes de su clase. NULL si la sesión no tiene jugador.
create function public.my_state() returns jsonb
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
    )
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.auth_uid = (select auth.uid());
$$;

-- Docente: crea una clase con un código único. Los capítulos vienen de content/modos.json.
create function public.create_class(
  p_label text,
  p_chapter_1 text[],
  p_chapter_2 text[],
  p_retention_days integer default 30
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_code text;
  v_all text[] := coalesce(p_chapter_1, '{}') || coalesce(p_chapter_2, '{}');
begin
  if not private.is_teacher() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_label, ''))) not between 1 and 40
     or cardinality(coalesce(p_chapter_1, '{}')) = 0
     or exists (select 1 from unnest(v_all) d where d is null or d !~ '^d[0-9]+$')
     or (select count(distinct d) from unnest(v_all) d) <> cardinality(v_all)
     or coalesce(p_retention_days, 0) not between 1 and 90 then
    raise exception 'invalid_class' using errcode = '22023';
  end if;

  loop
    v_code := private.random_code(6);
    begin
      insert into public.classes (teacher_id, label, code, chapter_1, chapter_2, expires_at)
      values (
        (select auth.uid()), trim(p_label), v_code, p_chapter_1, coalesce(p_chapter_2, '{}'),
        now() + make_interval(days => p_retention_days)
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      null; -- código ya usado: se genera otro
    end;
  end loop;

  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Docente: alumnado de una de sus clases (para /consola; nunca para /centro).
create function public.class_roster(p_class_id uuid)
returns table (
  player_id uuid,
  alias text,
  status text,
  phase text,
  current_dilemma text,
  last_seen_at timestamptz,
  finished boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.alias, p.status, r.phase, r.current_dilemma, p.last_seen_at, r.finished_at is not null
  from public.players p
  left join public.runs r on r.player_id = p.id
  where p.class_id = p_class_id
    and p_class_id in (select private.my_class_ids())
  order by lower(p.alias);
$$;

-- Mantiene el proyecto activo (el plan Free pausa tras 7 días sin actividad).
create function public.ping() returns text
language sql stable security definer set search_path = '' as $$
  select case when count(*) >= 0 then 'pong' end from public.classes;
$$;

revoke all on function public.my_state(), public.create_class(text, text[], text[], integer),
  public.class_roster(uuid), public.ping() from public, anon, authenticated;
grant execute on function public.my_state(), public.create_class(text, text[], text[], integer),
  public.class_roster(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Funciones svc_*: solo las llama la Edge Function `partida` (service_role)
-- ─────────────────────────────────────────────────────────────────────────────

-- Une una sesión a una clase. El alias ya viene validado y normalizado (NFC) por `partida`.
-- Idempotente: si la sesión ya es de esta clase, devuelve el jugador existente.
create function public.svc_join(p_auth_uid uuid, p_code text, p_alias text) returns jsonb
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
      return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label, 'resumed', false);
    exception
      when check_violation then
        return jsonb_build_object('status', 'alias_format');
      when unique_violation then
        -- Doble toque: la otra petición ya creó el jugador de esta sesión.
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
  return jsonb_build_object('status', 'ok', 'alias', v_player.alias, 'classLabel', v_class.label, 'resumed', true);
end $$;

revoke all on function public.svc_join(uuid, text, text) from public, anon, authenticated;
grant execute on function public.svc_join(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Retención (§11.5): borrado diario de clases caducadas y de sesiones anónimas huérfanas
-- ─────────────────────────────────────────────────────────────────────────────

create function private.purge_expired() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.classes where expires_at < now(); -- cascada: players, runs, answers, alerts…
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '1 day'
    and not exists (select 1 from public.players p where p.auth_uid = u.id)
    and not exists (select 1 from public.recovery_requests r where r.new_auth_uid = u.id);
end $$;
revoke all on function private.purge_expired() from public;

select cron.schedule('anomalia-purge-expired', '0 4 * * *', 'select private.purge_expired()');
