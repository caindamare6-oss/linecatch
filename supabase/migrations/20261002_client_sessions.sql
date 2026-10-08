-- Returning-client recognition. A token in localStorage (kind = 'session') or in a
-- missed-call text link (kind = 'link') maps back to one client of one barber.
-- Only a SHA-256 hash of the token is stored, so a database leak can't be replayed.
-- verified = the token proves the holder received a text at that phone; tokens issued
-- from a typed-in phone number are unverified and get a narrower view of the client.
create table if not exists client_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number text not null,
  token_hash text not null unique,
  kind text not null check (kind in ('session', 'link')),
  verified boolean not null default false,
  display_name text,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_sessions_client_idx on client_sessions(user_id, phone_number);
create index if not exists client_sessions_expires_idx on client_sessions(expires_at);
-- Server-only: no policies, so anon/authenticated clients can't read tokens.
alter table client_sessions enable row level security;
