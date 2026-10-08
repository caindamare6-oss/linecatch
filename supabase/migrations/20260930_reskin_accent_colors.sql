-- RUN AFTER the champagne reskin is deployed (not applied yet).
-- Accent text is now dark (#121110), so accents must be light enough to read it on.
-- Maps the old neon picks (and the never-shipped barbershop reds) to the new set.
update public.users set accent_color = case accent_color
  when '#00F5A0' then '#D4AF7A'  -- Mint      -> Champagne
  when '#FFD700' then '#D4AF7A'  -- Gold      -> Champagne
  when '#FF6B6B' then '#E3A4A4'  -- Coral     -> Rose
  when '#FB923C' then '#E0926A'  -- Orange    -> Copper
  when '#38BDF8' then '#8FB8DE'  -- Sky       -> Sky
  when '#A78BFA' then '#E0D9CD'  -- Violet    -> Pearl
  when '#C8372D' then '#D4AF7A'  -- Pole Red  -> Champagne
  when '#7A2A2A' then '#E3A4A4'  -- Oxblood   -> Rose
  when '#2F4F7F' then '#8FB8DE'  -- Navy      -> Sky
  when '#2F6B45' then '#A8C49A'  -- Forest    -> Sage
  when '#A4552C' then '#E0926A'  -- Copper    -> Copper
  when '#8C6A2E' then '#D4AF7A'  -- Brass     -> Champagne
  else accent_color end
where accent_color in ('#00F5A0','#FFD700','#FF6B6B','#FB923C','#38BDF8','#A78BFA',
                       '#C8372D','#7A2A2A','#2F4F7F','#2F6B45','#A4552C','#8C6A2E');
alter table public.users alter column accent_color set default '#D4AF7A';
