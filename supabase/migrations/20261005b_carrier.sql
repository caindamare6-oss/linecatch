-- The barber's cell carrier, so Settings shows the one forwarding code that works for them.
-- Found automatically (Twilio Lookup) or picked by the barber; cleared when their cell number changes.
alter table public.users add column if not exists carrier text;
do $$ begin
  alter table public.users add constraint users_carrier_check check (carrier in ('tmobile', 'att', 'verizon', 'other'));
exception when duplicate_object then null; end $$;
