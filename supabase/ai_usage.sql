-- SPPD Generator — kuota + audit pemakaian AI (/api/gemini)
-- Jalankan di Supabase Dashboard → SQL Editor (sekali saja).
-- Tanpa tabel ini, endpoint AI menolak semua request (fail-closed).

create table if not exists public.sppd_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default CURRENT_DATE,
  count int not null default 0,
  last_at timestamptz,
  last_mode text,
  primary key (user_id, day)
);

alter table public.sppd_ai_usage enable row level security;

drop policy if exists "Users read own ai usage" on public.sppd_ai_usage;
create policy "Users read own ai usage"
  on public.sppd_ai_usage for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own ai usage" on public.sppd_ai_usage;
create policy "Users insert own ai usage"
  on public.sppd_ai_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own ai usage" on public.sppd_ai_usage;
create policy "Users update own ai usage"
  on public.sppd_ai_usage for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger anti-curang: tiap INSERT/UPDATE, count dipaksa naik tepat +1
-- dari nilai lama. User tidak bisa me-reset kuotanya sendiri via REST.
create or replace function public.sppd_ai_usage_bump()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.count := coalesce(OLD.count, 0) + 1;
  return NEW;
end;
$$;

drop trigger if exists sppd_ai_usage_bump on public.sppd_ai_usage;
create trigger sppd_ai_usage_bump
  before insert or update on public.sppd_ai_usage
  for each row execute procedure public.sppd_ai_usage_bump();

-- Audit: 20 pemakaian terakhir semua user (hanya untuk admin via dashboard)
-- select user_id, day, count, last_at, last_mode
-- from public.sppd_ai_usage order by last_at desc limit 20;
