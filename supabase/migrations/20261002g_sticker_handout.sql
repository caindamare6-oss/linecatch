-- Door-to-door: the founder hands a printed QR sticker to a shop in person. Recording which shop got
-- which code lets the barber's setup start with the shop name filled in, and shows who hasn't
-- finished setting up yet. Nothing is shipped, so no address is needed.
alter table sticker_codes add column if not exists handed_out_at timestamptz;
alter table sticker_codes add column if not exists handed_to text;
alter table sticker_codes add column if not exists handed_out_by uuid references auth.users(id);
create index if not exists sticker_codes_handed_out_idx on sticker_codes (handed_out_at) where handed_out_at is not null;
