-- 1. Missed-call text style, picked in Settings: casual (default), professional, or custom
--    (the barber's own words in users.custom_message, which is kept as is).
alter table public.users add column if not exists missed_call_style text not null default 'casual';
do $$ begin
  alter table public.users add constraint users_missed_call_style_check check (missed_call_style in ('casual', 'professional', 'custom'));
exception when duplicate_object then null; end $$;

-- 2. Short links in texts: linecatch.app/c/Ab3dE6fG redirects to a path on the app.
create table if not exists public.short_links (
  code text primary key,
  target text not null,                 -- path on the app, always starting with "/"
  created_at timestamptz not null default now()
);
alter table public.short_links enable row level security;
-- Server only: no browser access at all.
revoke all on table public.short_links from anon, authenticated;
