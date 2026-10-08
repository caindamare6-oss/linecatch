-- Portfolio v2: cut tags on photos, a cover photo instead of a profile photo, and a short
-- details line on services ("Taper" · "Taper with a lineup").

-- A portfolio photo can name the cut it shows, as one of the barber's own services.
-- Deleting the service just leaves the photo untagged.
alter table public.portfolio_photos
  add column if not exists service_id uuid references public.services(id) on delete set null;
create index if not exists portfolio_photos_service_idx on public.portfolio_photos (service_id);

-- The big photo at the top of the barber's page. Replaces the profile photo everywhere.
alter table public.users add column if not exists cover_url text;
alter table public.users add column if not exists cover_path text;

-- Barbers who already added a profile photo keep it as their cover, so no page goes blank.
update public.users set cover_url = avatar_url where cover_url is null and avatar_url is not null;

-- One short line under a service name on the booking and portfolio pages.
alter table public.services add column if not exists description text;
do $$ begin
  alter table public.services add constraint services_description_length check (description is null or char_length(description) <= 80);
exception when duplicate_object then null; end $$;

-- Covers live in their own public bucket (same limits as portfolio photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
