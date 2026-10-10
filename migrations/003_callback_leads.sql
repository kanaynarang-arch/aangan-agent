-- A callback exists to turn a dropped call into a lead: the conversation becomes a new, scored call linked to the dropped one.

alter table calls add column callback_of uuid references calls (id) on delete set null;

alter table outbound_calls add column lead_call_id uuid references calls (id) on delete set null;

create index calls_callback_of_idx on calls (callback_of);
