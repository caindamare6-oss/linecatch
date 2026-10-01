-- Champagne gold ("gold") replaces dark + green ("mint") as the LineCatch default theme.
-- Additive: barbers who picked another theme keep it; only the old default moves.
alter table users alter column theme set default 'gold';
update users set theme = 'gold' where theme = 'mint' or theme is null;
