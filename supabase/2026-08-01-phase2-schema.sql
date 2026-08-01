-- KWARE Banking — Phase 2 schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / drop-and-recreate for policies.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- module_settings: the two named accounts + threshold per module
-- (mirrors the "Lookups" tab in your spreadsheet)
-- ─────────────────────────────────────────────────────────────
create table if not exists module_settings (
  module text primary key check (module in ('heloc', 'credit_card')),
  checking_account_name text not null,
  target_account_name text not null,   -- HELOC account name, or Credit Card account name
  threshold numeric not null default 150,
  updated_at timestamptz not null default now()
);

-- Seed with the values from your design doc / spreadsheet Lookups tab.
-- Edit the credit_card row once you tell me the real account names.
insert into module_settings (module, checking_account_name, target_account_name, threshold)
values
  ('heloc', 'BOA Checking - 3474', 'BOA Heloc - 8100', 150),
  ('credit_card', 'TBD Checking', 'TBD Credit Card', 150)
on conflict (module) do nothing;

-- ─────────────────────────────────────────────────────────────
-- months: one row per module per calendar month
-- ─────────────────────────────────────────────────────────────
create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('heloc', 'credit_card')),
  month int not null check (month between 1 and 12),
  year int not null check (year between 2020 and 2100),
  opening_balance numeric not null default 0,  -- opening balance of the target (HELOC/CC) account
  created_at timestamptz not null default now(),
  unique (module, month, year)
);

-- ─────────────────────────────────────────────────────────────
-- weeks: the 4 auto-split weeks per month (1-8, 9-14, 15-22, 23-EOM)
-- ─────────────────────────────────────────────────────────────
create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  week_number int not null check (week_number between 1 and 4),
  start_date date not null,
  end_date date not null,
  beginning_balance_override numeric,       -- null = roll forward from prior week/month
  bank_checking_balance numeric not null default 0,  -- manual input
  other_income numeric not null default 0,           -- manual input
  transfer_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (month_id, week_number)
);

-- ─────────────────────────────────────────────────────────────
-- bills: raw rows from the pasted Quicken export
-- ─────────────────────────────────────────────────────────────
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references months(id) on delete cascade,
  status text,                 -- 'Auto' | 'Upcoming' | ...
  due_date date not null,
  payee text not null,
  amount numeric not null,     -- signed: negative = payment, positive = deposit
  account_used text not null,  -- matches module_settings.checking_account_name / target_account_name
  method text,                 -- 'Payment' | 'Deposit'
  created_at timestamptz not null default now()
);

create index if not exists bills_month_idx on bills (month_id);
create index if not exists bills_due_date_idx on bills (due_date);
create index if not exists weeks_month_idx on weeks (month_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- No login screen in this app — it's a single-user tool gated only
-- by knowing the Supabase URL + publishable key. That's an intentional
-- tradeoff for now; say the word if you want real auth added later.
-- ─────────────────────────────────────────────────────────────
alter table module_settings enable row level security;
alter table months enable row level security;
alter table weeks enable row level security;
alter table bills enable row level security;

drop policy if exists "anon full access" on module_settings;
create policy "anon full access" on module_settings for all using (true) with check (true);

drop policy if exists "anon full access" on months;
create policy "anon full access" on months for all using (true) with check (true);

drop policy if exists "anon full access" on weeks;
create policy "anon full access" on weeks for all using (true) with check (true);

drop policy if exists "anon full access" on bills;
create policy "anon full access" on bills for all using (true) with check (true);
