-- MeinWochenplan: Cloud-Speicher für den Abgleich PC <-> iPhone.
-- Einmal im Supabase-Projekt unter "SQL Editor" einfügen und auf "Run" klicken.
-- Die Tabellen sind von außen gesperrt (RLS ohne Policies); Zugriff nur über die Funktionen,
-- und die wollen den Haushalts-Code (mind. 16 Zeichen) – wer den Code nicht kennt, sieht nichts.

create table if not exists public.wochenplan_state (
  haushalt text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.wochenplan_fotos (
  id text primary key,
  haushalt text not null,
  data text not null,
  created_at timestamptz not null default now()
);

alter table public.wochenplan_state enable row level security;
alter table public.wochenplan_fotos enable row level security;

create or replace function public.wp_get_state(code text)
returns json language sql security definer set search_path = public as $$
  select json_build_object('data', data, 'updated_at', updated_at)
  from wochenplan_state where haushalt = code and length(code) >= 16;
$$;

create or replace function public.wp_put_state(code text, payload jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz := clock_timestamp();
begin
  if length(code) < 16 then raise exception 'Haushalts-Code zu kurz'; end if;
  insert into wochenplan_state (haushalt, data, updated_at) values (code, payload, t)
  on conflict (haushalt) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

create or replace function public.wp_put_foto(code text, foto_id text, payload text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(code) < 16 then raise exception 'Haushalts-Code zu kurz'; end if;
  if length(payload) > 3000000 then raise exception 'Foto zu groß'; end if;
  insert into wochenplan_fotos (id, haushalt, data) values (foto_id, code, payload)
  on conflict (id) do nothing;
end $$;

create or replace function public.wp_get_foto(code text, foto_id text)
returns text language sql security definer set search_path = public as $$
  select data from wochenplan_fotos where id = foto_id and haushalt = code;
$$;

create or replace function public.wp_delete_foto(code text, foto_id text)
returns void language sql security definer set search_path = public as $$
  delete from wochenplan_fotos where id = foto_id and haushalt = code;
$$;

grant execute on function public.wp_get_state(text) to anon;
grant execute on function public.wp_put_state(text, jsonb) to anon;
grant execute on function public.wp_put_foto(text, text, text) to anon;
grant execute on function public.wp_get_foto(text, text) to anon;
grant execute on function public.wp_delete_foto(text, text) to anon;
