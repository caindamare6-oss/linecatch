-- LineCatch dark + green ("mint") replaces Black & White as the default theme.
alter table users alter column theme set default 'mint';
update users set theme = 'mint' where theme = 'classic';
