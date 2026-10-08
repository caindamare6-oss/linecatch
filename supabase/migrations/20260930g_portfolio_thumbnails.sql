-- Small copy of each portfolio photo for the grid and hero cards; the full photo loads only in the viewer.
alter table portfolio_photos add column if not exists thumb_url text;
alter table portfolio_photos add column if not exists thumb_path text;
