-- Barber's private notes on a client ("#2 on the sides, hot towel"). Shown on the client profile.
alter table contacts add column if not exists notes text;
do $$ begin
  alter table contacts add constraint contacts_notes_length check (notes is null or length(notes) <= 1000);
exception when duplicate_object then null; end $$;
