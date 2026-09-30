-- Everyone starts on Basic; claiming a QR sticker moves a barber to Full (see api/stickers/claim).
alter table users alter column plan set default 'basic';

update users u set plan = 'basic'
where plan <> 'basic'
  and not exists (
    select 1 from sticker_codes s where s.owner_user_id = u.user_id and s.status = 'active'
  );
