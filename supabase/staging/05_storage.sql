insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('portfolio', 'portfolio', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "Public avatar read" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'avatars'::text));
create policy "Users can update own avatar" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can upload own avatar" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
