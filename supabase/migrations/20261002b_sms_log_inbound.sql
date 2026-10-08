-- Messages tab reads from sms_log instead of the Twilio API, so client replies need a home too.
-- Outbound rows: to_number = client. Inbound rows: from_number = client, to_number = barber's LineCatch number.
alter table sms_log add column if not exists direction text not null default 'outbound';
alter table sms_log add column if not exists from_number text;
do $$ begin
  alter table sms_log add constraint sms_log_direction_check check (direction in ('outbound', 'inbound'));
exception when duplicate_object then null; end $$;
alter table sms_log drop constraint if exists sms_log_status_check;
alter table sms_log add constraint sms_log_status_check check (status in ('pending', 'sent', 'dev', 'failed', 'received'));
create index if not exists idx_sms_log_user_from on sms_log (user_id, from_number, created_at desc) where direction = 'inbound';
