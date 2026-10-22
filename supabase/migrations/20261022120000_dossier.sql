-- ANOMALÍA · M4 (expediente PDF)
-- · El final se fija al entrar en el epílogo: lo calcula `partida` con shared/game (§5.6).
-- · Reflexión final (svc_reflect): cierra la partida y genera el código de verificación
--   ANM-XXXX-XXXX que se imprime en el PDF. Puede crear una alerta privada, que ya no
--   cuelga siempre de una respuesta.
-- · my_dossier(): datos del expediente para el propio alumno, desde el epílogo. El nombre
--   real nunca llega al servidor: se escribe en el móvil al generar el PDF.
-- · verify_run(): el docente comprueba un código de sus clases y lee los textos de esa
--   partida para compararlos con el PDF (D-03). Sustituye a la Edge Function `verify-code`.

-- ── Alertas: también de la reflexión final ──

alter table public.alerts add column player_id uuid references public.players on delete cascade;
update public.alerts al set player_id = a.player_id from public.answers a where a.id = al.answer_id;
alter table public.alerts
  alter column player_id set not null,
  alter column answer_id drop not null;
create index alerts_player_id_idx on public.alerts (player_id);
alter table public.alerts drop constraint alerts_text_check;
alter table public.alerts add constraint alerts_text_check check (char_length(text) <= 3000);

-- Las alertas de una respuesta (svc_justify, svc_reply, svc_alert) no indican el jugador:
-- se toma de la respuesta.
create function private.alerts_fill_player() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.player_id is null and new.answer_id is not null then
    select a.player_id into new.player_id from public.answers a where a.id = new.answer_id;
  end if;
  return new;
end $$;
revoke all on function private.alerts_fill_player() from public;
create trigger alerts_fill_player before insert on public.alerts
for each row execute function private.alerts_fill_player();

-- ── Estado de la partida: incluye el final ──

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
      'ending', r.ending
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

-- ── «Continuar» al epílogo fija el final ──

drop function public.svc_advance(uuid, text, text, text, text);
create function public.svc_advance(
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
      ending = case when p_to_phase = 'epilogue' then coalesce(p_ending, ending) else ending end
  where player_id = p_player_id
    and phase = p_from_phase
    and current_dilemma is not distinct from p_from_dilemma;
  return jsonb_build_object(
    'status', case when found then 'ok' else 'stale' end,
    'state', private.player_state(p_player_id)
  );
end $$;

-- ── Reflexión final ──

create function public.svc_reflect(
  p_player_id uuid,
  p_text text,
  p_ending text,
  p_alert boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text;
begin
  perform 1 from public.runs
  where player_id = p_player_id and phase = 'reflection'
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'state', private.player_state(p_player_id));
  end if;

  -- 32^8 combinaciones: una colisión es casi imposible, pero si ocurre se genera otro.
  loop
    v_code := 'ANM-' || private.random_code(4) || '-' || private.random_code(4);
    exit when not exists (select 1 from public.runs r where r.verify_code = v_code);
  end loop;

  update public.runs
  set final_reflection = p_text,
      ending = coalesce(ending, p_ending),
      verify_code = v_code,
      finished_at = now(),
      phase = 'dossier'
  where player_id = p_player_id;

  if p_alert then
    insert into public.alerts (player_id, class_id, text)
    select p.id, p.class_id, left(p_text, 3000) from public.players p where p.id = p_player_id;
  end if;

  return jsonb_build_object('status', 'ok', 'state', private.player_state(p_player_id));
end $$;

-- ── Expediente: decisiones con sus textos ──

create function private.run_answers(p_player_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'dilemmaId', a.dilemma_id,
    'choice', a.choice,
    'justification', a.justification,
    'objector', a.objector,
    'objection', a.objection,
    'reply', a.reply
  ) order by a.chosen_at), '[]'::jsonb)
  from public.answers a
  where a.player_id = p_player_id;
$$;
revoke all on function private.run_answers(uuid) from public;

create function public.my_dossier() returns jsonb
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
    'answers', private.run_answers(p.id)
  )
  from public.players p
  join public.classes c on c.id = p.class_id
  join public.runs r on r.player_id = p.id
  where p.id = private.my_player_id()
    and r.phase in ('epilogue', 'reflection', 'dossier', 'done');
$$;

-- Acepta el código con o sin «ANM», con guiones o espacios y en minúsculas.
create function public.verify_run(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with typed as (
    select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as v
  ),
  code as (
    select case when length(v) = 11 and v like 'ANM%' then substr(v, 4) else v end as v
    from typed
  )
  select jsonb_build_object(
    'alias', p.alias,
    'classLabel', c.label,
    'status', p.status,
    'verifyCode', r.verify_code,
    'finishedAt', r.finished_at,
    'ending', r.ending,
    'world', jsonb_build_object(
      'poder', r.poder,
      'responsabilidad', r.responsabilidad,
      'equidad', r.equidad,
      'confianza', r.confianza
    ),
    'reflection', r.final_reflection,
    'answers', private.run_answers(p.id)
  )
  from code
  join public.runs r
    on r.verify_code = 'ANM-' || substr(code.v, 1, 4) || '-' || substr(code.v, 5, 4)
  join public.players p on p.id = r.player_id
  join public.classes c on c.id = p.class_id
  where length(code.v) = 8
    and c.id in (select private.my_class_ids());
$$;

-- ── Consola: alertas de respuestas y de la reflexión final ──

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
        'dilemmaId', a.dilemma_id, -- null: alerta de la reflexión final
        'text', al.text,
        'justification', a.justification,
        'reply', a.reply
      ) order by al.created_at desc)
      from public.alerts al
      join public.players p on p.id = al.player_id
      left join public.answers a on a.id = al.answer_id
      where al.class_id = p_class_id
    ), '[]'::jsonb)
  ) end;
$$;

revoke all on function
  public.svc_advance(uuid, text, text, text, text, text),
  public.svc_reflect(uuid, text, text, boolean)
from public, anon, authenticated;
grant execute on function
  public.svc_advance(uuid, text, text, text, text, text),
  public.svc_reflect(uuid, text, text, boolean)
to service_role;

revoke all on function public.my_dossier(), public.verify_run(text) from public, anon, authenticated;
grant execute on function public.my_dossier(), public.verify_run(text) to authenticated;
