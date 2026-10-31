-- MeinWochenplan: Konten, Haushalte, Besitzer-Freigabe. Einmal im SQL-Editor ausführen (nach supabase-einrichtung.sql).
-- Jedes Konto gehört zu einem Haushalt (Standard: eigener). Daten sieht nur, wer freigegeben ist und zum Haushalt gehört.
-- Besitzer wird, wer als Erstes die alten Daten mit dem bisherigen Haushalts-Code übernimmt (wp2_claim_legacy).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  household uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.household_state (
  household uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.household_fotos (
  id text primary key,
  household uuid not null,
  data text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.household_state enable row level security;
alter table public.household_fotos enable row level security;

-- Neues Konto → Profil (noch nicht freigegeben, eigener Haushalt)
create or replace function public.wp2_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, email, name, household)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''), new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists wp2_on_auth_user on auth.users;
create trigger wp2_on_auth_user after insert on auth.users for each row execute function public.wp2_new_user();

-- Haushalt des angemeldeten, freigegebenen Kontos (sonst Fehler)
create or replace function public.wp2_household() returns uuid
language plpgsql security definer set search_path = public stable as $$
declare h uuid;
begin
  select household into h from profiles where user_id = auth.uid() and approved;
  if h is null then raise exception 'Konto noch nicht freigegeben'; end if;
  return h;
end $$;

create or replace function public.wp2_is_owner() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'owner' and approved);
$$;

create or replace function public.wp2_me() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object('email', email, 'name', name, 'role', role, 'approved', approved, 'household', household,
    'owner_exists', exists (select 1 from profiles where role = 'owner'))
  from profiles where user_id = auth.uid();
$$;

create or replace function public.wp2_get_state() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object('data', data, 'updated_at', updated_at) from household_state where household = wp2_household();
$$;

create or replace function public.wp2_put_state(payload jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := clock_timestamp(); h uuid := wp2_household();
begin
  insert into household_state (household, data, updated_at) values (h, payload, t)
  on conflict (household) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

create or replace function public.wp2_put_foto(foto_id text, payload text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(payload) > 3000000 then raise exception 'Foto zu groß'; end if;
  insert into household_fotos (id, household, data) values (foto_id, wp2_household(), payload) on conflict (id) do nothing;
end $$;

create or replace function public.wp2_get_foto(foto_id text) returns text
language sql security definer set search_path = public stable as $$
  select data from household_fotos where id = foto_id and household = wp2_household();
$$;

create or replace function public.wp2_delete_foto(foto_id text) returns void
language sql security definer set search_path = public as $$
  delete from household_fotos where id = foto_id and household = wp2_household();
$$;

-- Alte Daten (Haushalts-Code aus der Zeit vor den Konten) übernehmen. Gibt es noch keinen Besitzer,
-- wird dieses Konto Besitzer und ist sofort freigegeben – nur wer den alten Code kennt, kann das.
create or replace function public.wp2_claim_legacy(code text) returns text
language plpgsql security definer set search_path = public as $$
declare h uuid; becomes_owner boolean;
begin
  if not exists (select 1 from wochenplan_state where haushalt = code and length(code) >= 16) then
    raise exception 'Alter Haushalts-Code unbekannt';
  end if;
  becomes_owner := not exists (select 1 from profiles where role = 'owner');
  if becomes_owner then
    update profiles set role = 'owner', approved = true where user_id = auth.uid();
  end if;
  select household into h from profiles where user_id = auth.uid() and approved;
  if h is null then raise exception 'Konto noch nicht freigegeben'; end if;
  insert into household_state (household, data, updated_at)
    select h, data, clock_timestamp() from wochenplan_state where haushalt = code
  on conflict (household) do nothing; -- vorhandene (neuere) Daten nie mit dem alten Stand überschreiben
  insert into household_fotos (id, household, data, created_at)
    select id, h, data, created_at from wochenplan_fotos where haushalt = code
  on conflict (id) do nothing;
  return case when becomes_owner then 'besitzer' else 'übernommen' end;
end $$;

-- Verwaltung (nur Besitzer)
create or replace function public.wp2_list_users() returns json
language plpgsql security definer set search_path = public stable as $$
begin
  if not wp2_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  return (select coalesce(json_agg(json_build_object('user_id', p.user_id, 'email', p.email, 'name', p.name, 'role', p.role,
    'approved', p.approved, 'same_household', p.household = (select household from profiles where user_id = auth.uid()),
    'created_at', p.created_at) order by p.created_at), '[]'::json) from profiles p);
end $$;

-- aktion: 'freigeben' | 'sperren' | 'mein_haushalt' | 'eigener_haushalt'
create or replace function public.wp2_manage_user(target uuid, aktion text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not wp2_is_owner() then raise exception 'Nur für den Besitzer'; end if;
  if target = auth.uid() then raise exception 'Das eigene Konto lässt sich hier nicht ändern'; end if;
  if aktion = 'freigeben' then update profiles set approved = true where user_id = target;
  elsif aktion = 'sperren' then update profiles set approved = false where user_id = target;
  elsif aktion = 'mein_haushalt' then update profiles set household = (select household from profiles where user_id = auth.uid()) where user_id = target;
  elsif aktion = 'eigener_haushalt' then update profiles set household = target where user_id = target;
  else raise exception 'Unbekannte Aktion';
  end if;
end $$;

-- Name ändern (eigenes Konto)
create or replace function public.wp2_set_name(new_name text) returns void
language sql security definer set search_path = public as $$
  update profiles set name = left(new_name, 60) where user_id = auth.uid();
$$;

revoke all on function public.wp2_new_user() from public, anon, authenticated;
grant execute on function public.wp2_me(), public.wp2_get_state(), public.wp2_put_state(jsonb), public.wp2_put_foto(text, text),
  public.wp2_get_foto(text), public.wp2_delete_foto(text), public.wp2_claim_legacy(text), public.wp2_list_users(),
  public.wp2_manage_user(uuid, text), public.wp2_set_name(text) to authenticated;
revoke execute on function public.wp2_me(), public.wp2_get_state(), public.wp2_put_state(jsonb), public.wp2_put_foto(text, text),
  public.wp2_get_foto(text), public.wp2_delete_foto(text), public.wp2_claim_legacy(text), public.wp2_list_users(),
  public.wp2_manage_user(uuid, text), public.wp2_set_name(text) from anon, public;

-- Alte Funktionen mit Haushalts-Code abschalten, sobald alle Geräte mit Konto angemeldet sind:
revoke execute on function public.wp_get_state(text), public.wp_put_state(text, jsonb), public.wp_put_foto(text, text, text),
  public.wp_get_foto(text, text), public.wp_delete_foto(text, text) from anon, public;
