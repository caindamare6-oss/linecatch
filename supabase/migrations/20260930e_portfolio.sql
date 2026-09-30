-- Phase 4: public portfolio at linecatch.app/<slug>, themed per barber.

alter table users add column if not exists slug text;
alter table users add column if not exists theme text not null default 'classic';
do $$ begin
  alter table users add constraint users_theme_check check (theme in ('classic', 'mint', 'gold', 'midnight', 'cream'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table users add constraint users_slug_format check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');
exception when duplicate_object then null; end $$;
create unique index if not exists users_slug_key on users (slug) where slug is not null;

-- Backfill: shop name (or first name) made URL-safe, de-duplicated with -2, -3…
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in select user_id, business_name, first_name from users where slug is null order by created_at nulls last loop
    base := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(r.business_name), ''), nullif(trim(r.first_name), ''), 'barber')), '[^a-z0-9]+', '-', 'g'));
    base := left(base, 34);
    base := trim(both '-' from base);
    if length(base) < 3 then base := 'barber'; end if;
    candidate := base;
    n := 1;
    while exists (select 1 from users where slug = candidate)
       or candidate in ('api','auth','book','dashboard','login','manage','onboarding','privacy','s','terms','vip','admin','settings','app','www','help','support','about','pricing','blog','static','public') loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update users set slug = candidate where user_id = r.user_id;
  end loop;
end $$;

create table if not exists portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  storage_path text not null,
  url text not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_photos_user_idx on portfolio_photos (user_id, sort_order);
alter table portfolio_photos enable row level security;
do $$ begin
  create policy "Barbers view own portfolio photos" on portfolio_photos
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Public bucket: photos are shown to anyone who opens the page. Writes go through the API (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
