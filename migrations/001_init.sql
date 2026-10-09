-- Aangan agent: initial schema. Statements are separated by ";" at end of line.

create table calls (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'live' check (source in ('live', 'test')),
  vani_call_id text unique,
  fixture_id text,
  caller_phone text,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  duration_seconds integer not null default 0,
  recording_url text,
  transcript text,
  outside_hours boolean not null default false,
  call_type text not null default 'enquiry' check (call_type in ('enquiry', 'escalation', 'dropped')),
  tier text check (tier in ('green', 'amber', 'red', 'escalate', 'dropped')),
  ai_tier text,
  expected_tier text,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'failed')),
  outcome text,
  review_status text not null default 'none' check (review_status in ('none', 'pending', 'approved', 'dropped')),
  fields jsonb,
  criteria jsonb,
  reasons jsonb,
  uncertain jsonb,
  flags jsonb,
  handoff_summary text,
  consultation_booked boolean not null default false,
  consultation_at timestamptz,
  voice_cost_inr numeric(12, 4) not null default 0,
  ai_cost_inr numeric(12, 4) not null default 0,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index calls_phone_idx on calls (caller_phone);
create index calls_started_idx on calls (started_at desc);
create index calls_tier_idx on calls (tier);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_inr numeric(12, 4) not null default 0,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  channel text not null check (channel in ('hubspot', 'telegram', 'calcom')),
  status text not null check (status in ('sent', 'booked', 'skipped_test', 'dry_run', 'failed')),
  detail jsonb,
  external_id text,
  created_at timestamptz not null default now()
);

create index actions_call_idx on actions (call_id)
