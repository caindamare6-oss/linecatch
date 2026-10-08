-- A visit (solo booking or whole group) is closed out exactly once: when every person
-- is completed or cancelled and at least one was completed. The unique key guarantees
-- one loyalty text and one review request per visit, even if the last two actions race.
create table if not exists visit_closeouts (
  visit_key text primary key,
  user_id uuid not null,
  client_phone text not null,
  closed_at timestamptz not null default now()
);
alter table visit_closeouts enable row level security;
