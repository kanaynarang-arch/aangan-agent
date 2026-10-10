-- Callbacks started from the dashboard: Vani talking in the browser (no phone number needed) or ringing the lead's phone.

create table outbound_calls (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  vani_call_id text unique,
  mode text not null default 'browser' check (mode in ('browser', 'phone')),
  to_phone text,
  reason text not null check (reason in ('dropped', 'follow_up')),
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  duration_seconds integer not null default 0,
  recording_url text,
  transcript text,
  voice_cost_inr numeric(12, 4) not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index outbound_calls_call_idx on outbound_calls (call_id);
