-- MeinWochenplan: Kalender-Abo. Einmal im SQL-Editor ausführen (nach supabase-konten.sql).
-- Jeder Haushalt bekommt einen geheimen Link-Schlüssel. Wer den Link kennt, sieht nur den Kalender-Auszug
-- (Einkaufstage, offener Betrag, bald leer, Reste) – nicht die übrigen Daten.

create table if not exists public.household_calendar (
  household uuid primary key,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.household_calendar enable row level security;

-- Schlüssel des eigenen Haushalts (wird beim ersten Aufruf angelegt); erneuern = alter Link wird ungültig
create or replace function public.wp2_calendar_token(renew boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare h uuid := wp2_household(); t text;
begin
  if renew then delete from household_calendar where household = h; end if;
  select token into t from household_calendar where household = h;
  if t is null then
    t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into household_calendar (household, token) values (h, t);
  end if;
  return t;
end $$;

-- Für die Edge Function „kalender“: nur der Auszug „calendar“ aus dem Zustand
create or replace function public.wp2_calendar_feed(tok text) returns jsonb
language sql security definer set search_path = public stable as $$
  select s.data -> 'calendar' from household_calendar c join household_state s on s.household = c.household
  where c.token = tok and length(tok) >= 32;
$$;

revoke all on function public.wp2_calendar_token(boolean), public.wp2_calendar_feed(text) from public, anon, authenticated;
grant execute on function public.wp2_calendar_token(boolean) to authenticated;
grant execute on function public.wp2_calendar_feed(text) to anon, authenticated;
