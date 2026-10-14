-- Weekly summary email (Mondays): barbers can turn it off in Settings. On by default.
alter table public.users add column if not exists weekly_email boolean not null default true;
