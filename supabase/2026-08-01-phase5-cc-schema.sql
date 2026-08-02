-- KWARE Banking — Phase 5 schema (Credit Card module)
-- Run this in the Supabase SQL editor. Only adds the cc_transactions table —
-- months/weeks/module_settings already support the 'credit_card' module
-- from the Phase 2 schema.

create table if not exists cc_transactions (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  status text,
  txn_date date not null,
  description text not null,
  amount numeric not null,  -- signed: positive = charge (increases card debt), negative = credit/payment posted on the statement
  created_at timestamptz not null default now()
);

create index if not exists cc_transactions_month_idx on cc_transactions (month_id);
create index if not exists cc_transactions_date_idx on cc_transactions (txn_date);

alter table cc_transactions enable row level security;

drop policy if exists "anon full access" on cc_transactions;
create policy "anon full access" on cc_transactions for all using (true) with check (true);

-- Reminder: module_settings.credit_card still has placeholder account names
-- from Phase 2. Update it with your real checking/credit card account names:
--
-- update module_settings
-- set checking_account_name = 'your checking account name',
--     target_account_name = 'your credit card name'
-- where module = 'credit_card';
